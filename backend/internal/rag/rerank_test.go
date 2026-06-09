package rag

import (
	"context"
	"sort"
	"strings"
	"testing"

	"github.com/zcag/tela/backend/internal/testdb"
)

// fakeReranker scores a document 1.0 if it contains the marker, else 0.0 — a
// deterministic stand-in for a cross-encoder, used to prove rerank reorders.
type fakeReranker struct{ marker string }

func (f *fakeReranker) Rerank(_ context.Context, _ string, docs []string) ([]RerankResult, error) {
	out := make([]RerankResult, len(docs))
	for i, d := range docs {
		s := 0.0
		if strings.Contains(d, f.marker) {
			s = 1.0
		}
		out[i] = RerankResult{Index: i, Score: s}
	}
	sort.SliceStable(out, func(a, b int) bool { return out[a].Score > out[b].Score })
	return out, nil
}

func TestSearch_RerankReordersWhenEnabled(t *testing.T) {
	d := testdb.New(t)
	ctx := context.Background()
	u := newUser(t, d, "alice")
	sp := newSpace(t, d, "alpha", u)
	// Both match "alpha"; only the second carries the rerank marker.
	plain := newPage(t, d, sp, "Plain", "## A\nalpha alpha alpha alpha topic overview")
	marked := newPage(t, d, sp, "Marked", "## A\nalpha ZZMARKER detail")

	svc := NewServiceWithEmbedder(d, &fakeEmbedder{})
	if _, _, err := svc.ReindexSpace(ctx, sp); err != nil {
		t.Fatalf("index: %v", err)
	}

	// Baseline (no rerank) — just prove both are retrievable.
	base, err := svc.Search(ctx, u, "alpha", &sp, 5, "hybrid")
	if err != nil || len(base) < 2 {
		t.Fatalf("baseline search: %v (n=%d)", err, len(base))
	}

	// Enable rerank that forces the marked chunk to the top.
	svc.rr = &fakeReranker{marker: "ZZMARKER"}
	got, err := svc.Search(ctx, u, "alpha", &sp, 5, "hybrid")
	if err != nil {
		t.Fatalf("reranked search: %v", err)
	}
	if got[0].PageID != marked {
		t.Errorf("reranked top = %d, want the marked page %d", got[0].PageID, marked)
	}
	_ = plain
}
