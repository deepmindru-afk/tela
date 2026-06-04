package rag

import (
	"context"
	"sort"
	"strings"
)

// Hit is one ranked chunk result. Carries everything a caller needs to cite
// the source: page id + heading path (and the API layer adds the in-app URL).
type Hit struct {
	ChunkID     int64   `json:"chunk_id"`
	PageID      int64   `json:"page_id"`
	SpaceID     int64   `json:"space_id"`
	Title       string  `json:"title"`
	HeadingPath string  `json:"heading_path"`
	Snippet     string  `json:"snippet"`
	Score       float64 `json:"score"`
}

// rrfK is the standard Reciprocal Rank Fusion constant. Larger = flatter
// weighting across ranks; 60 is the well-trodden default and needs no score
// calibration between the lexical and vector rankers.
const rrfK = 60

// Search runs hybrid retrieval scoped to what userID can access (the
// space_access view). mode is "hybrid" (default), "semantic", or "lexical".
// spaceID, when non-nil, narrows to a single space.
func (s *Service) Search(ctx context.Context, userID int64, q string, spaceID *int64, limit int, mode string) ([]Hit, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return []Hit{}, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	// Pull a deeper candidate pool from each ranker than we return, so fusion
	// has room to reorder.
	pool := limit * 4
	if pool < 40 {
		pool = 40
	}

	var lex, vec []int64
	if mode != "semantic" {
		ids, err := s.lexicalRank(ctx, userID, q, spaceID, pool)
		if err != nil {
			return nil, err
		}
		lex = ids
	}
	if mode != "lexical" {
		ids, err := s.vectorRank(ctx, userID, q, spaceID, pool)
		if err != nil {
			return nil, err
		}
		vec = ids
	}

	// Reciprocal Rank Fusion: each list contributes 1/(k + rank) to a chunk's
	// score; chunks ranked highly by both rankers rise to the top.
	score := map[int64]float64{}
	order := []int64{}
	add := func(ids []int64) {
		for rank, id := range ids {
			if _, seen := score[id]; !seen {
				order = append(order, id)
			}
			score[id] += 1.0 / float64(rrfK+rank+1)
		}
	}
	add(lex)
	add(vec)

	sort.SliceStable(order, func(i, j int) bool { return score[order[i]] > score[order[j]] })
	if len(order) > limit {
		order = order[:limit]
	}
	return s.hydrate(ctx, order, score)
}

// lexicalRank returns chunk ids ordered by BM25 over page_chunks_fts, scoped by
// space_access (and optionally a single space).
func (s *Service) lexicalRank(ctx context.Context, userID int64, q string, spaceID *int64, limit int) ([]int64, error) {
	fts := ftsMatch(q)
	if fts == "" {
		return nil, nil
	}
	sb := strings.Builder{}
	sb.WriteString(`
		SELECT pc.id
		  FROM page_chunks_fts f
		  JOIN page_chunks pc ON pc.id = f.rowid
		  JOIN pages p ON p.id = pc.page_id
		  JOIN (SELECT DISTINCT space_id FROM space_access WHERE user_id = ?) sm
		    ON sm.space_id = pc.space_id
		 WHERE page_chunks_fts MATCH ?`)
	args := []any{userID, fts}
	if spaceID != nil {
		sb.WriteString(` AND pc.space_id = ?`)
		args = append(args, *spaceID)
	}
	sb.WriteString(` ORDER BY bm25(page_chunks_fts) ASC LIMIT ?`)
	args = append(args, limit)
	return s.queryIDs(ctx, sb.String(), args...)
}

// vectorRank embeds the query and returns chunk ids ordered by cosine
// similarity, scoped by space_access. Brute-force over the (small) candidate
// set via the tela_cosine UDF — no ANN index needed at wiki scale.
func (s *Service) vectorRank(ctx context.Context, userID int64, q string, spaceID *int64, limit int) ([]int64, error) {
	vec, err := s.emb.Embed(ctx, q)
	if err != nil {
		return nil, err
	}
	qvec := EncodeVector(vec)
	sb := strings.Builder{}
	sb.WriteString(`
		SELECT pc.id
		  FROM page_chunks pc
		  JOIN pages p ON p.id = pc.page_id
		  JOIN (SELECT DISTINCT space_id FROM space_access WHERE user_id = ?) sm
		    ON sm.space_id = pc.space_id
		 WHERE pc.embedding IS NOT NULL`)
	args := []any{userID}
	if spaceID != nil {
		sb.WriteString(` AND pc.space_id = ?`)
		args = append(args, *spaceID)
	}
	sb.WriteString(` ORDER BY tela_cosine(pc.embedding, ?) DESC LIMIT ?`)
	args = append(args, qvec, limit)
	return s.queryIDs(ctx, sb.String(), args...)
}

func (s *Service) queryIDs(ctx context.Context, query string, args ...any) ([]int64, error) {
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// hydrate fetches display fields for the fused id list and returns hits in the
// fused order (the IN-clause result order is undefined, so we re-sort by score).
func (s *Service) hydrate(ctx context.Context, ids []int64, score map[int64]float64) ([]Hit, error) {
	if len(ids) == 0 {
		return []Hit{}, nil
	}
	ph := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		ph[i] = "?"
		args[i] = id
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT pc.id, pc.page_id, pc.space_id, pc.heading_path, pc.content, p.title
		  FROM page_chunks pc
		  JOIN pages p ON p.id = pc.page_id
		 WHERE pc.id IN (`+strings.Join(ph, ",")+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byID := make(map[int64]Hit, len(ids))
	for rows.Next() {
		var (
			h       Hit
			content string
		)
		if err := rows.Scan(&h.ChunkID, &h.PageID, &h.SpaceID, &h.HeadingPath, &content, &h.Title); err != nil {
			return nil, err
		}
		h.Snippet = snippet(content, 280)
		h.Score = score[h.ChunkID]
		byID[h.ChunkID] = h
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]Hit, 0, len(ids))
	for _, id := range ids {
		if h, ok := byID[id]; ok {
			out = append(out, h)
		}
	}
	return out, nil
}

// ftsMatch builds a per-term phrase-prefix MATCH expression: each whitespace
// term is double-quote-wrapped (neutralising FTS5 operators) and suffixed with
// `*`. Mirrors the page-level buildFTSBodyMatch in the api package. Returns ""
// when every term sanitises to empty.
func ftsMatch(q string) string {
	var terms []string
	for _, raw := range strings.Fields(q) {
		cleaned := strings.ReplaceAll(strings.ReplaceAll(raw, "*", ""), `"`, `""`)
		if cleaned == "" {
			continue
		}
		terms = append(terms, `"`+cleaned+`"*`)
	}
	return strings.Join(terms, " ")
}

// snippet returns a single-line preview of content, truncated to roughly n
// runes on a word boundary.
func snippet(content string, n int) string {
	content = strings.Join(strings.Fields(content), " ")
	if len(content) <= n {
		return content
	}
	cut := content[:n]
	if i := strings.LastIndexByte(cut, ' '); i > n/2 {
		cut = cut[:i]
	}
	return cut + "…"
}
