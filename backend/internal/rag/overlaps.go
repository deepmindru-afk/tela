package rag

import "context"

// Overlap / near-duplicate detection — wiki hygiene. As a knowledge base grows,
// the same topic gets re-documented in two or three places that then drift out of
// sync. Guru and Slite make "verification" a headline; the upstream problem is
// duplication. This finds page PAIRS that genuinely share near-identical passages
// — real merge/redirect candidates — so the corpus can be kept DRY instead of
// silently fragmenting.
//
// Two stages, because a single centroid-vs-centroid cosine is NOT a duplicate
// signal: in a thematically tight corpus (one product, one team) every page's
// average embedding points the same way, so unrelated pages routinely score 0.90+
// centroid similarity. The discriminator is whether the pages share an actual
// near-identical CHUNK (someone re-documented / copy-pasted the same thing).
// So: (1) a cheap centroid scan prefilters to a small candidate set, then (2) each
// candidate is verified by its max chunk-pair cosine — and THAT is what we report.

const (
	// centroidPrefilter: candidate pairs must be at least this centroid-similar.
	// Just a cheap net to bound the chunk-verify cost — real duplicates score far
	// higher here anyway, so a generous-but-not-everything cut keeps the candidate
	// set small even in a coherent corpus.
	centroidPrefilter = 0.82
	// dupChunkThreshold: a candidate is a real duplicate only if some chunk pair is
	// at least this cosine-similar. Calibrated against live data where genuine dups
	// land ~0.97 and merely-related pages top out ~0.89 — 0.92 sits in that gap.
	dupChunkThreshold = 0.92
)

// OverlapPair is two pages that share near-identical content.
type OverlapPair struct {
	PageA      int64   `json:"page_a"`
	TitleA     string  `json:"title_a"`
	PageB      int64   `json:"page_b"`
	TitleB     string  `json:"title_b"`
	SpaceA     int64   `json:"space_a"`
	SpaceB     int64   `json:"space_b"`
	Similarity float64 `json:"similarity"` // max chunk-pair cosine similarity, [0,1]
}

// FindOverlaps returns page pairs that share a near-identical passage, ranked
// most-similar-first, access-scoped through space_access. spaceID, when non-nil,
// restricts to overlaps WITHIN one space (the common "is this space full of
// duplicates?" case). A pair where the caller can't read both pages never appears.
// threshold is the minimum chunk-pair cosine to count as a duplicate (default
// dupChunkThreshold); limit defaults to 50.
func (s *Service) FindOverlaps(ctx context.Context, userID int64, spaceID *int64, threshold float64, limit int) ([]OverlapPair, error) {
	if threshold <= 0 || threshold > 1 {
		threshold = dupChunkThreshold
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	prefilterDist := 1 - centroidPrefilter

	qb := &queryBuilder{}
	uid := qb.arg(userID)
	cte := `
		cent AS (
		  SELECT pc.page_id, p.space_id, p.title, avg(pc.embedding) AS c
		    FROM page_chunks pc
		    JOIN pages p ON p.id = pc.page_id AND p.deleted_at IS NULL
		    JOIN (SELECT DISTINCT space_id FROM space_access WHERE user_id = ` + uid + `) sm
		      ON sm.space_id = p.space_id`
	if spaceID != nil {
		cte += ` WHERE p.space_id = ` + qb.arg(*spaceID)
	}
	cte += `
		   AND pc.embedding IS NOT NULL
		 GROUP BY pc.page_id, p.space_id, p.title
		)`
	pf := qb.arg(prefilterDist)
	th := qb.arg(threshold)
	lim := qb.arg(limit)
	// Stage 1 (cand): centroid prefilter — cheap n²-over-page-centroids cut to a
	// small candidate set. Stage 2 (LATERAL m): verify each candidate by its max
	// chunk-pair cosine; only real shared-passage pairs survive, and that score is
	// what we rank and report.
	q := `WITH ` + cte + `,
		cand AS (
		  SELECT a.page_id AS pa, a.title AS ta, a.space_id AS sa,
		         b.page_id AS pb, b.title AS tb, b.space_id AS sb
		    FROM cent a JOIN cent b ON a.page_id < b.page_id
		   WHERE (a.c <=> b.c) <= ` + pf + `
		)
		SELECT cand.pa, cand.ta, cand.sa, cand.pb, cand.tb, cand.sb, m.sim
		  FROM cand
		  CROSS JOIN LATERAL (
		    SELECT max(1 - (x.embedding <=> y.embedding)) AS sim
		      FROM page_chunks x, page_chunks y
		     WHERE x.page_id = cand.pa AND y.page_id = cand.pb
		  ) m
		 WHERE m.sim >= ` + th + `
		 ORDER BY m.sim DESC
		 LIMIT ` + lim

	rows, err := s.db.QueryContext(ctx, q, qb.args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []OverlapPair{}
	for rows.Next() {
		var p OverlapPair
		if err := rows.Scan(&p.PageA, &p.TitleA, &p.SpaceA, &p.PageB, &p.TitleB, &p.SpaceB, &p.Similarity); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
