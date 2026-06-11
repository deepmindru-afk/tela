package rag

import (
	"context"
	"database/sql"
)

// Same-space semantic neighbours — the input to the agreement/contradiction pass
// (internal/agreement). Unlike RelatedPages this is NOT user-scoped: it's a
// trusted background computation, and it is deliberately restricted to the
// page's OWN space so every neighbour shares the page's access (a reader who can
// see the page can see everything the agreement result names — no cross-space
// leak). Uses stored centroids only, no live embedder.

// Neighbor is one same-space page near the target, with its text for the LLM.
type Neighbor struct {
	PageID     int64
	Title      string
	Body       string
	Similarity float64
}

// PageNeighborsInSpace returns up to `limit` pages in the same space as pageID,
// nearest first by centroid cosine, at least `minSim` similar (and never the
// page itself). Empty when the page has no embedded chunks or no close neighbour.
func (s *Service) PageNeighborsInSpace(ctx context.Context, pageID int64, limit int, minSim float64) ([]Neighbor, error) {
	if limit <= 0 || limit > 20 {
		limit = 6
	}
	if minSim <= 0 || minSim >= 1 {
		minSim = 0.6
	}
	maxDist := 1 - minSim

	// Centroid of the target page (NULL when it has no embedded chunks → skip
	// gracefully with no neighbours, rather than erroring on the NULL scan).
	var centroid sql.NullString
	if err := s.db.QueryRowContext(ctx, `
		SELECT avg(embedding)::text FROM page_chunks WHERE page_id = $1 AND embedding IS NOT NULL`,
		pageID,
	).Scan(&centroid); err != nil {
		return nil, err
	}
	if !centroid.Valid {
		return nil, nil
	}

	rows, err := s.db.QueryContext(ctx, `
		WITH tgt AS (SELECT space_id FROM pages WHERE id = $1)
		SELECT p.id, p.title, p.body, MIN(pc.embedding <=> $2::vector) AS dist
		  FROM page_chunks pc
		  JOIN pages p ON p.id = pc.page_id AND p.deleted_at IS NULL
		  JOIN tgt ON tgt.space_id = p.space_id
		 WHERE pc.embedding IS NOT NULL AND p.id <> $1
		 GROUP BY p.id, p.title, p.body
		HAVING MIN(pc.embedding <=> $2::vector) <= $3
		 ORDER BY dist ASC
		 LIMIT $4`, pageID, centroid.String, maxDist, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Neighbor{}
	for rows.Next() {
		var n Neighbor
		var dist float64
		if err := rows.Scan(&n.PageID, &n.Title, &n.Body, &dist); err != nil {
			return nil, err
		}
		n.Similarity = 1 - dist
		out = append(out, n)
	}
	return out, rows.Err()
}
