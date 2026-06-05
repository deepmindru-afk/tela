package api

import (
	"context"
	"errors"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/zcag/tela/backend/internal/models"
	"github.com/zcag/tela/backend/internal/rag"
)

// registerMCPTools wires the tela tool surface onto the MCP server. Each tool
// reads identity from the request (mcpIdentity), calls the shared xCore that
// also backs the REST route, and returns a typed Out so the SDK emits an output
// schema + structured content. Write tools additionally gate on key scope via
// mcpRequireWrite (the public-path mount defers method-scope to the tool).
func (s *Server) registerMCPTools(server *mcp.Server) {
	readOnly := &mcp.ToolAnnotations{ReadOnlyHint: true}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "list_spaces",
		Description: "List every space the API key can access (id, name, slug).",
		Annotations: readOnly,
	}, s.mcpListSpaces)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "list_pages",
		Description: "Flat page listing in a space. Optional parent_id for direct children (omit for top-level pages).",
		Annotations: readOnly,
	}, s.mcpListPages)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_page",
		Description: "Full markdown body + metadata for a numeric page id.",
		Annotations: readOnly,
	}, s.mcpGetPage)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "list_backlinks",
		Description: "Pages that link to the given page via [[wikilink]] / tela://page/{id}.",
		Annotations: readOnly,
	}, s.mcpListBacklinks)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "search",
		Description: "Ranked full-text search over title + body, snippet-highlighted. Optional space_id narrows to one space.",
		Annotations: readOnly,
	}, s.mcpSearch)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "search_bodies",
		Description: "Ranked full-text body search within one space (no snippets). Re-fetch full bodies via get_page.",
		Annotations: readOnly,
	}, s.mcpSearchBodies)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "semantic_search",
		Description: "Meaning-aware chunk search (vector + keyword, RRF). Returns ranked chunks with chunk_id + citations (page id + heading path). Requires a configured embedder.",
		Annotations: readOnly,
	}, s.mcpSemanticSearch)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "read_chunk",
		Description: "Fetch one chunk's full section text by chunk_id (from semantic_search). Middle granularity between a search snippet and get_page.",
		Annotations: readOnly,
	}, s.mcpReadChunk)
}

// ---- shared output shapes ------------------------------------------------

// mcpPage is a page row plus the human-shareable in-app URL. Embeds models.Page
// so the body + metadata fields are promoted verbatim.
type mcpPage struct {
	models.Page
	URL string `json:"url"`
}

func mcpPageURL(p models.Page) string {
	return publicBaseURL() + pageAppPath(p.SpaceID, p.ID, p.Title)
}

// ---- list_spaces ---------------------------------------------------------

type listSpacesIn struct{}

type mcpSpace struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type listSpacesOut struct {
	Spaces []mcpSpace `json:"spaces"`
}

func (s *Server) mcpListSpaces(ctx context.Context, req *mcp.CallToolRequest, _ listSpacesIn) (*mcp.CallToolResult, listSpacesOut, error) {
	u, _ := mcpIdentity(req)
	if u == nil {
		return mcpUnauthErr(), listSpacesOut{}, nil
	}
	spaces, ae := s.listSpacesCore(ctx, u)
	if ae != nil {
		return mcpErr(ae), listSpacesOut{}, nil
	}
	out := listSpacesOut{Spaces: make([]mcpSpace, len(spaces))}
	for i, sp := range spaces {
		out.Spaces[i] = mcpSpace{ID: sp.ID, Name: sp.Name, Slug: sp.Slug}
	}
	return nil, out, nil
}

// ---- list_pages ----------------------------------------------------------

type listPagesIn struct {
	SpaceID  int64  `json:"space_id" jsonschema:"id of the space to list pages in"`
	ParentID *int64 `json:"parent_id,omitempty" jsonschema:"optional parent page id; omit for top-level pages"`
}

type mcpPageListItem struct {
	ID       int64  `json:"id"`
	SpaceID  int64  `json:"space_id"`
	ParentID *int64 `json:"parent_id"`
	Title    string `json:"title"`
	Position int64  `json:"position"`
	URL      string `json:"url"`
}

type listPagesOut struct {
	Pages []mcpPageListItem `json:"pages"`
}

func (s *Server) mcpListPages(ctx context.Context, req *mcp.CallToolRequest, in listPagesIn) (*mcp.CallToolResult, listPagesOut, error) {
	u, k := mcpIdentity(req)
	if u == nil {
		return mcpUnauthErr(), listPagesOut{}, nil
	}
	pages, ae := s.listPagesCore(ctx, u, k, in.SpaceID, in.ParentID)
	if ae != nil {
		return mcpErr(ae), listPagesOut{}, nil
	}
	out := listPagesOut{Pages: make([]mcpPageListItem, len(pages))}
	for i, p := range pages {
		out.Pages[i] = mcpPageListItem{
			ID:       p.ID,
			SpaceID:  p.SpaceID,
			ParentID: p.ParentID,
			Title:    p.Title,
			Position: p.Position,
			URL:      mcpPageURL(p.Page),
		}
	}
	return nil, out, nil
}

// ---- get_page ------------------------------------------------------------

type getPageIn struct {
	ID int64 `json:"id" jsonschema:"numeric page id"`
}

type getPageOut struct {
	Page mcpPage `json:"page"`
}

func (s *Server) mcpGetPage(ctx context.Context, req *mcp.CallToolRequest, in getPageIn) (*mcp.CallToolResult, getPageOut, error) {
	u, k := mcpIdentity(req)
	if u == nil {
		return mcpUnauthErr(), getPageOut{}, nil
	}
	p, ae := s.getPageCore(ctx, u, k, in.ID)
	if ae != nil {
		return mcpErr(ae), getPageOut{}, nil
	}
	return nil, getPageOut{Page: mcpPage{Page: p, URL: mcpPageURL(p)}}, nil
}

// ---- list_backlinks ------------------------------------------------------

type listBacklinksIn struct {
	PageID int64 `json:"page_id" jsonschema:"page whose incoming links to list"`
}

type listBacklinksOut struct {
	Backlinks []backlinkHit `json:"backlinks"`
}

func (s *Server) mcpListBacklinks(ctx context.Context, req *mcp.CallToolRequest, in listBacklinksIn) (*mcp.CallToolResult, listBacklinksOut, error) {
	u, k := mcpIdentity(req)
	if u == nil {
		return mcpUnauthErr(), listBacklinksOut{}, nil
	}
	hits, ae := s.backlinksCore(ctx, u, k, in.PageID)
	if ae != nil {
		return mcpErr(ae), listBacklinksOut{}, nil
	}
	return nil, listBacklinksOut{Backlinks: hits}, nil
}

// ---- search --------------------------------------------------------------

type searchIn struct {
	Query   string `json:"query" jsonschema:"search terms"`
	SpaceID *int64 `json:"space_id,omitempty" jsonschema:"optional space id to restrict results to"`
	Limit   int    `json:"limit,omitempty" jsonschema:"max results (default 25)"`
}

type searchOut struct {
	Results []searchHit `json:"results"`
}

func (s *Server) mcpSearch(ctx context.Context, req *mcp.CallToolRequest, in searchIn) (*mcp.CallToolResult, searchOut, error) {
	u, k := mcpIdentity(req)
	if u == nil {
		return mcpUnauthErr(), searchOut{}, nil
	}
	results, ae := s.searchCore(ctx, u, k, in.Query, in.SpaceID, in.Limit)
	if ae != nil {
		return mcpErr(ae), searchOut{}, nil
	}
	return nil, searchOut{Results: results}, nil
}

// ---- search_bodies -------------------------------------------------------

type searchBodiesIn struct {
	Query   string `json:"query" jsonschema:"search terms"`
	SpaceID int64  `json:"space_id" jsonschema:"id of the space to search within"`
	Limit   int    `json:"limit,omitempty" jsonschema:"max results 1-100 (default 20)"`
}

type searchBodiesOut struct {
	Results []searchBodyHit `json:"results"`
}

func (s *Server) mcpSearchBodies(ctx context.Context, req *mcp.CallToolRequest, in searchBodiesIn) (*mcp.CallToolResult, searchBodiesOut, error) {
	u, k := mcpIdentity(req)
	if u == nil {
		return mcpUnauthErr(), searchBodiesOut{}, nil
	}
	results, ae := s.searchBodiesCore(ctx, u, k, in.SpaceID, in.Query, in.Limit)
	if ae != nil {
		return mcpErr(ae), searchBodiesOut{}, nil
	}
	return nil, searchBodiesOut{Results: results}, nil
}

// ---- semantic_search -----------------------------------------------------

type semanticSearchIn struct {
	Query   string `json:"query" jsonschema:"natural-language query"`
	SpaceID *int64 `json:"space_id,omitempty" jsonschema:"optional space id to restrict results to"`
	Limit   int    `json:"limit,omitempty" jsonschema:"max chunks (default service-defined)"`
	Mode    string `json:"mode,omitempty" jsonschema:"hybrid|semantic|lexical (default hybrid)"`
}

type semanticSearchOut struct {
	Results []rag.Hit `json:"results"`
}

func (s *Server) mcpSemanticSearch(ctx context.Context, req *mcp.CallToolRequest, in semanticSearchIn) (*mcp.CallToolResult, semanticSearchOut, error) {
	u, k := mcpIdentity(req)
	if u == nil {
		return mcpUnauthErr(), semanticSearchOut{}, nil
	}
	if !s.rag.Enabled() {
		return mcpErr(&apiErr{503, "rag_disabled", "semantic search is not configured"}), semanticSearchOut{}, nil
	}
	// A space-pinned bearer key may only ever see its one space.
	spaceID := in.SpaceID
	if k != nil && k.SpaceID != nil {
		spaceID = k.SpaceID
	}
	hits, err := s.rag.Search(ctx, u.ID, in.Query, spaceID, in.Limit, in.Mode)
	if err != nil {
		return mcpErr(&apiErr{500, "internal", "semantic search failed"}), semanticSearchOut{}, nil
	}
	return nil, semanticSearchOut{Results: hits}, nil
}

// ---- read_chunk ----------------------------------------------------------

type readChunkIn struct {
	ChunkID int64 `json:"chunk_id" jsonschema:"chunk id from a semantic_search result"`
}

type readChunkOut struct {
	Chunk rag.ChunkRead `json:"chunk"`
}

func (s *Server) mcpReadChunk(ctx context.Context, req *mcp.CallToolRequest, in readChunkIn) (*mcp.CallToolResult, readChunkOut, error) {
	u, k := mcpIdentity(req)
	if u == nil {
		return mcpUnauthErr(), readChunkOut{}, nil
	}
	if !s.rag.Enabled() {
		return mcpErr(&apiErr{503, "rag_disabled", "semantic search is not configured"}), readChunkOut{}, nil
	}
	var spaceID *int64
	if k != nil && k.SpaceID != nil {
		spaceID = k.SpaceID
	}
	chunk, err := s.rag.ReadChunk(ctx, u.ID, in.ChunkID, spaceID)
	if err != nil {
		if errors.Is(err, rag.ErrChunkNotFound) {
			return mcpErr(&apiErr{404, "not_found", "chunk not found"}), readChunkOut{}, nil
		}
		return mcpErr(&apiErr{500, "internal", "read chunk failed"}), readChunkOut{}, nil
	}
	return nil, readChunkOut{Chunk: *chunk}, nil
}
