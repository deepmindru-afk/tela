package rag

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// ErrChunkNotFound is returned when a chunk id doesn't exist OR the caller can't
// access its page. The two are deliberately indistinguishable so a probing
// caller can't learn that a chunk exists in a space they can't read.
var ErrChunkNotFound = errors.New("chunk not found")

// ChunkRead is the full text of one chunk plus its citation. Unlike a search
// Hit (which carries a truncated snippet), this returns the complete section
// content — the chunk-granularity read between snippet and whole-page get_page.
type ChunkRead struct {
	ChunkID     int64  `json:"chunk_id"`
	PageID      int64  `json:"page_id"`
	SpaceID     int64  `json:"space_id"`
	Title       string `json:"title"`
	HeadingPath string `json:"heading_path"`
	Content     string `json:"content"`
	UpdatedAt   string `json:"updated_at"`
}

// ReadChunk returns one chunk's full content, authorized through the LIVE page
// row joined to space_access (the anti-leak invariant — same as search). spaceID,
// when non-nil, additionally narrows to that space (space-scoped bearer keys).
// Returns ErrChunkNotFound when the chunk doesn't exist or is out of scope.
func (s *Service) ReadChunk(ctx context.Context, userID, chunkID int64, spaceID *int64) (*ChunkRead, error) {
	qb := &queryBuilder{}
	cid := qb.arg(chunkID)
	uid := qb.arg(userID)
	query := `
		SELECT pc.id, pc.page_id, p.space_id, pc.heading_path, pc.content, p.title, p.updated_at
		  FROM page_chunks pc
		  JOIN pages p ON p.id = pc.page_id AND p.deleted_at IS NULL
		  JOIN (SELECT DISTINCT space_id FROM space_access WHERE user_id = ` + uid + `) sm
		    ON sm.space_id = p.space_id
		 WHERE pc.id = ` + cid
	if spaceID != nil {
		query += ` AND p.space_id = ` + qb.arg(*spaceID)
	}

	var c ChunkRead
	err := s.db.QueryRowContext(ctx, query, qb.args...).Scan(
		&c.ChunkID, &c.PageID, &c.SpaceID, &c.HeadingPath, &c.Content, &c.Title, &c.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrChunkNotFound
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ChunkContents returns the FULL section text for a set of chunk ids, keyed by
// chunk id, authorized through the live page row joined to space_access (the
// same anti-leak path as ReadChunk/Search). Out-of-scope or missing ids are
// silently omitted from the map — callers fall back to whatever they have. Used
// by "ask your docs" to ground the LLM on whole chunks instead of the truncated
// search snippet. One query, not N — safe to call with the top-k hit ids.
func (s *Service) ChunkContents(ctx context.Context, userID int64, ids []int64, spaceID *int64) (map[int64]string, error) {
	if len(ids) == 0 {
		return map[int64]string{}, nil
	}
	qb := &queryBuilder{}
	uid := qb.arg(userID)
	ph := make([]string, len(ids))
	for i, id := range ids {
		ph[i] = qb.arg(id)
	}
	query := `
		SELECT pc.id, pc.content
		  FROM page_chunks pc
		  JOIN pages p ON p.id = pc.page_id AND p.deleted_at IS NULL
		  JOIN (SELECT DISTINCT space_id FROM space_access WHERE user_id = ` + uid + `) sm
		    ON sm.space_id = p.space_id
		 WHERE pc.id IN (` + strings.Join(ph, ",") + `)`
	if spaceID != nil {
		query += ` AND p.space_id = ` + qb.arg(*spaceID)
	}
	rows, err := s.db.QueryContext(ctx, query, qb.args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[int64]string, len(ids))
	for rows.Next() {
		var id int64
		var content string
		if err := rows.Scan(&id, &content); err != nil {
			return nil, err
		}
		out[id] = content
	}
	return out, rows.Err()
}

// PageBodies returns the full markdown body for a set of page ids, keyed by page
// id, authorized through the same space_access anti-leak join as ChunkContents.
// Out-of-scope or missing ids are silently omitted. Used by "ask your docs" for
// parent-document retrieval: when a retrieved chunk points at a page, the ask
// path can feed the LLM the WHOLE page so an answer that lives in a table/list
// the chunker split (e.g. a "services using X" registry) survives intact.
func (s *Service) PageBodies(ctx context.Context, userID int64, ids []int64, spaceID *int64) (map[int64]string, error) {
	if len(ids) == 0 {
		return map[int64]string{}, nil
	}
	qb := &queryBuilder{}
	uid := qb.arg(userID)
	ph := make([]string, len(ids))
	for i, id := range ids {
		ph[i] = qb.arg(id)
	}
	query := `
		SELECT p.id, p.body
		  FROM pages p
		  JOIN (SELECT DISTINCT space_id FROM space_access WHERE user_id = ` + uid + `) sm
		    ON sm.space_id = p.space_id
		 WHERE p.deleted_at IS NULL AND p.id IN (` + strings.Join(ph, ",") + `)`
	if spaceID != nil {
		query += ` AND p.space_id = ` + qb.arg(*spaceID)
	}
	rows, err := s.db.QueryContext(ctx, query, qb.args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[int64]string, len(ids))
	for rows.Next() {
		var id int64
		var body string
		if err := rows.Scan(&id, &body); err != nil {
			return nil, err
		}
		out[id] = body
	}
	return out, rows.Err()
}

// HubPage is a topical-hub candidate: a page and how many of its chunks match
// ANY query term (OR semantics), plus a representative chunk for fallback.
type HubPage struct {
	PageID  int64
	Title   string
	ChunkID int64
	Count   int
}

// HubPages returns the pages whose chunks mention the query terms most often,
// ordered by that count. Deliberately OR-matched (not the AND of plainto_tsquery
// that lexicalRank/search use): for an aggregate question like "which projects
// use kafka", the authoritative answer is the page that is ABOUT kafka (every
// chunk mentions it), which an AND over "project & use & kafka" misses and a
// precision reranker buries. The ask path uses this rerank-independent signal to
// decide which whole pages to expand. Same space_access anti-leak join as the
// rest of read.go. Empty/stopword-only queries match nothing (return no rows).
func (s *Service) HubPages(ctx context.Context, userID int64, query string, spaceID *int64, limit int) ([]HubPage, error) {
	if limit <= 0 {
		limit = 8
	}
	qb := &queryBuilder{}
	uid := qb.arg(userID)
	q := qb.arg(query)
	// plainto_tsquery sanitises the input to `'a' & 'b' & …`; swapping & → | turns
	// it into an OR query without any hand-built (injectable) tsquery string.
	sql := `
		SELECT p.id, p.title, min(pc.id), count(*)
		  FROM page_chunks pc
		  JOIN pages p ON p.id = pc.page_id AND p.deleted_at IS NULL
		  JOIN (SELECT DISTINCT space_id FROM space_access WHERE user_id = ` + uid + `) sm
		    ON sm.space_id = p.space_id
		 WHERE pc.content_tsv @@ replace(plainto_tsquery('english', ` + q + `)::text, '&', '|')::tsquery`
	if spaceID != nil {
		sql += ` AND p.space_id = ` + qb.arg(*spaceID)
	}
	sql += ` GROUP BY p.id, p.title ORDER BY count(*) DESC, p.id LIMIT ` + qb.arg(limit)

	rows, err := s.db.QueryContext(ctx, sql, qb.args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []HubPage
	for rows.Next() {
		var h HubPage
		if err := rows.Scan(&h.PageID, &h.Title, &h.ChunkID, &h.Count); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}
