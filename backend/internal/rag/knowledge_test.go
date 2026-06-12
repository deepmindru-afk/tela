package rag

import (
	"context"
	"testing"

	"github.com/zcag/tela/backend/internal/testdb"
)

func TestRelatedPages_RanksAndScopes(t *testing.T) {
	d := testdb.New(t)
	ctx := context.Background()
	alice := newUser(t, d, "alice")
	bob := newUser(t, d, "bob")
	sp := newSpace(t, d, "alpha", alice)

	deployA := newPage(t, d, sp, "Deploying releases", "## How\ndeploy release build server production ship rollout")
	deployB := newPage(t, d, sp, "Release pipeline", "## Pipeline\ndeploy release build server staging production ship")
	newPage(t, d, sp, "Banana bread", "## Recipe\nbananas flour sugar butter oven bake dessert")

	svc := NewServiceWithEmbedder(d, &fakeEmbedder{})
	if _, _, err := svc.ReindexSpace(ctx, sp); err != nil {
		t.Fatalf("index: %v", err)
	}

	rel, err := svc.RelatedPages(ctx, alice, deployA, nil, 5)
	if err != nil {
		t.Fatalf("related: %v", err)
	}
	if len(rel) == 0 {
		t.Fatal("no related pages")
	}
	if rel[0].PageID != deployB {
		t.Errorf("top related = %d (%q), want the release page %d", rel[0].PageID, rel[0].Title, deployB)
	}
	if rel[0].Similarity <= 0 || rel[0].Similarity > 1.0001 {
		t.Errorf("similarity %.3f out of (0,1]", rel[0].Similarity)
	}
	for _, r := range rel {
		if r.PageID == deployA {
			t.Error("related list must not include the source page")
		}
	}

	// Access scope: bob can't read alice's space → no related (no leak).
	bobRel, err := svc.RelatedPages(ctx, bob, deployA, nil, 5)
	if err != nil {
		t.Fatalf("bob related: %v", err)
	}
	if len(bobRel) != 0 {
		t.Fatalf("LEAK: bob got %d related pages for a page he can't read", len(bobRel))
	}
}

func TestSuggestLinks_FromDraftText(t *testing.T) {
	d := testdb.New(t)
	ctx := context.Background()
	u := newUser(t, d, "alice")
	sp := newSpace(t, d, "alpha", u)
	deploy := newPage(t, d, sp, "Deploying", "## How\ndeploy release build server production ship rollout")
	newPage(t, d, sp, "Banana bread", "## Recipe\nbananas flour sugar butter oven bake")

	svc := NewServiceWithEmbedder(d, &fakeEmbedder{})
	if _, _, err := svc.ReindexSpace(ctx, sp); err != nil {
		t.Fatalf("index: %v", err)
	}

	out, err := svc.SuggestLinks(ctx, u, "notes on how we deploy a release to production", nil, 5)
	if err != nil {
		t.Fatalf("suggest: %v", err)
	}
	if len(out) == 0 || out[0].PageID != deploy {
		t.Fatalf("top suggestion = %v, want the deploy page %d", out, deploy)
	}
}

func TestFindOverlaps_DetectsNearDuplicates(t *testing.T) {
	d := testdb.New(t)
	ctx := context.Background()
	u := newUser(t, d, "alice")
	sp := newSpace(t, d, "alpha", u)
	// A genuine near-duplicate: same title + body, so a chunk pair is near-identical
	// (what the chunk-level verifier keys on, not just close centroids).
	dupBody := "## Steps\ndeploy release build server staging production ship rollout pipeline verify smoke healthcheck rollback runbook"
	dupA := newPage(t, d, sp, "Deploying a release", dupBody)
	dupB := newPage(t, d, sp, "Deploying a release", dupBody)
	newPage(t, d, sp, "Banana bread", "## Recipe\nbananas flour sugar butter oven bake dessert")

	svc := NewServiceWithEmbedder(d, &fakeEmbedder{})
	if _, _, err := svc.ReindexSpace(ctx, sp); err != nil {
		t.Fatalf("index: %v", err)
	}

	pairs, err := svc.FindOverlaps(ctx, u, &sp, 0, 10)
	if err != nil {
		t.Fatalf("overlaps: %v", err)
	}
	// Only the real duplicate pair should surface — the unrelated page must not,
	// even though a tight corpus can make centroids look close.
	if len(pairs) != 1 {
		t.Fatalf("got %d overlap pairs, want exactly the duplicate pair: %+v", len(pairs), pairs)
	}
	top := pairs[0]
	gotPair := map[int64]bool{top.PageA: true, top.PageB: true}
	if !gotPair[dupA] || !gotPair[dupB] {
		t.Errorf("top overlap = (%d,%d), want the duplicate pair (%d,%d)", top.PageA, top.PageB, dupA, dupB)
	}
	if top.Similarity < 0.92 {
		t.Errorf("overlap similarity %.3f below duplicate threshold", top.Similarity)
	}
}
