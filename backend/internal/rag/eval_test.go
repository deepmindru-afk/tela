package rag

import (
	"context"
	"testing"

	"github.com/zcag/tela/backend/internal/testdb"
)

func TestEvaluate_RecallMRRAndNDCG(t *testing.T) {
	d := testdb.New(t)
	ctx := context.Background()
	u := newUser(t, d, "alice")
	sp := newSpace(t, d, "alpha", u)
	deploy := newPage(t, d, sp, "Deploying", "## How\nrun make deploy to ship a release to production")
	bread := newPage(t, d, sp, "Banana bread", "## Recipe\nmash bananas fold flour sugar bake")
	_ = newPage(t, d, sp, "Login", "## Auth\nusers sign in with email and password tokens")

	svc := NewServiceWithEmbedder(d, &fakeEmbedder{})
	if _, _, err := svc.ReindexSpace(ctx, sp); err != nil {
		t.Fatalf("index: %v", err)
	}

	cases := []EvalCase{
		{Query: "deploy release production", ExpectPages: []int64{deploy}},
		{Query: "bananas flour sugar bake", ExpectPages: []int64{bread}},
		{Query: "email password sign in", ExpectSubstr: []string{"password"}},
		{Query: "deploy release production", ExpectPages: []int64{999999}}, // target page can never appear → guaranteed miss
	}

	res, err := svc.Evaluate(ctx, u, cases, 5, "hybrid")
	if err != nil {
		t.Fatalf("evaluate: %v", err)
	}
	if res.Cases != 4 {
		t.Fatalf("cases = %d, want 4", res.Cases)
	}
	// Three lexically-aligned queries should hit; the xyzzy one should miss.
	if res.RecallAtK < 0.74 || res.RecallAtK > 0.76 {
		t.Errorf("recall@5 = %.3f, want ~0.75", res.RecallAtK)
	}
	if res.MRR <= 0 || res.MRR > 1 {
		t.Errorf("MRR = %.3f, want (0,1]", res.MRR)
	}
	if res.NDCG <= 0 || res.NDCG > 1 {
		t.Errorf("nDCG = %.3f, want (0,1]", res.NDCG)
	}
	// The deploy/bread queries should rank their target at #1.
	if res.PerCase[0].FirstRank != 1 {
		t.Errorf("deploy query first_rank = %d, want 1", res.PerCase[0].FirstRank)
	}
	if !res.PerCase[2].Hit {
		t.Errorf("substring-expectation case did not hit")
	}
	if res.PerCase[3].Hit {
		t.Errorf("unrelated query unexpectedly hit")
	}
}

func TestEvaluate_EmptySetErrors(t *testing.T) {
	d := testdb.New(t)
	svc := NewServiceWithEmbedder(d, &fakeEmbedder{})
	if _, err := svc.Evaluate(context.Background(), 1, nil, 5, "hybrid"); err == nil {
		t.Fatal("expected error on empty golden set")
	}
}
