package rag

import (
	"context"
	"fmt"
	"math"
	"strings"
)

// Retrieval evaluation — the measurement layer. Every change to chunking,
// embedding, fusion, or ranking should be judged against a golden set of
// (query → expected page) pairs drawn from the real corpus, not by eyeballing.
// "You can't improve retrieval you don't measure" is the one rule every
// production-RAG postmortem agrees on; this is tela's harness for it.
//
// The golden set is plain JSON (see EvalCase) so it lives outside the binary and
// grows over time. Scoring is access-scoped through the same Search path users
// hit, so the numbers reflect what a given user would actually retrieve.

// EvalCase is one labelled query. A hit is a retrieved chunk whose page is in
// ExpectPages, OR whose snippet/title contains any string in ExpectSubstr
// (case-insensitive). At least one expectation must be set.
type EvalCase struct {
	Query        string   `json:"query"`
	SpaceID      *int64   `json:"space_id,omitempty"`
	ExpectPages  []int64  `json:"expect_pages,omitempty"`
	ExpectSubstr []string `json:"expect_substr,omitempty"`
}

// CaseScore is the per-query outcome: the 1-based rank of the first relevant hit
// (0 = not found within k), and how many relevant hits landed in the top-k.
type CaseScore struct {
	Query     string `json:"query"`
	FirstRank int    `json:"first_rank"`
	Relevant  int    `json:"relevant_in_k"`
	Hit       bool   `json:"hit"`
}

// EvalResult aggregates a run. RecallAtK is the fraction of cases with ≥1
// relevant hit in the top-k (a.k.a. success@k for single-target queries); MRR is
// the mean reciprocal first-relevant rank; NDCG is mean binary nDCG@k.
type EvalResult struct {
	Cases     int         `json:"cases"`
	K         int         `json:"k"`
	Mode      string      `json:"mode"`
	RecallAtK float64     `json:"recall_at_k"`
	MRR       float64     `json:"mrr"`
	NDCG      float64     `json:"ndcg_at_k"`
	PerCase   []CaseScore `json:"per_case"`
}

// Evaluate runs every case through Search (scoped to userID) and scores it.
func (s *Service) Evaluate(ctx context.Context, userID int64, cases []EvalCase, k int, mode string) (EvalResult, error) {
	if k <= 0 {
		k = 10
	}
	res := EvalResult{Cases: len(cases), K: k, Mode: mode}
	if len(cases) == 0 {
		return res, fmt.Errorf("eval: empty golden set")
	}
	var sumRR, sumNDCG float64
	for _, c := range cases {
		if c.Query == "" || (len(c.ExpectPages) == 0 && len(c.ExpectSubstr) == 0) {
			return res, fmt.Errorf("eval: case %q has no query or no expectation", c.Query)
		}
		hits, err := s.Search(ctx, userID, c.Query, c.SpaceID, k, mode)
		if err != nil {
			return res, fmt.Errorf("eval: search %q: %w", c.Query, err)
		}
		cs := scoreCase(c, hits)
		res.PerCase = append(res.PerCase, cs)
		if cs.Hit {
			res.RecallAtK++
			sumRR += 1.0 / float64(cs.FirstRank)
		}
		sumNDCG += ndcgBinary(c, hits, k)
	}
	n := float64(len(cases))
	res.RecallAtK /= n
	res.MRR = sumRR / n
	res.NDCG = sumNDCG / n
	return res, nil
}

func scoreCase(c EvalCase, hits []Hit) CaseScore {
	cs := CaseScore{Query: c.Query}
	for i, h := range hits {
		if relevant(c, h) {
			cs.Relevant++
			if cs.FirstRank == 0 {
				cs.FirstRank = i + 1
				cs.Hit = true
			}
		}
	}
	return cs
}

func relevant(c EvalCase, h Hit) bool {
	for _, p := range c.ExpectPages {
		if h.PageID == p {
			return true
		}
	}
	if len(c.ExpectSubstr) > 0 {
		hay := strings.ToLower(h.Title + " " + h.HeadingPath + " " + h.Snippet)
		for _, sub := range c.ExpectSubstr {
			if sub != "" && strings.Contains(hay, strings.ToLower(sub)) {
				return true
			}
		}
	}
	return false
}

// ndcgBinary is nDCG@k with binary relevance: DCG sums 1/log2(rank+1) over
// relevant hits; IDCG assumes the min(#expected-ish, k) relevant docs sit at the
// top. With one target this reduces to 1/log2(firstRank+1).
func ndcgBinary(c EvalCase, hits []Hit, k int) float64 {
	var dcg float64
	rel := 0
	for i, h := range hits {
		if i >= k {
			break
		}
		if relevant(c, h) {
			dcg += 1.0 / math.Log2(float64(i+2))
			rel++
		}
	}
	if rel == 0 {
		return 0
	}
	// Ideal: the same number of relevant hits packed at the top ranks.
	var idcg float64
	for i := 0; i < rel; i++ {
		idcg += 1.0 / math.Log2(float64(i+2))
	}
	return dcg / idcg
}
