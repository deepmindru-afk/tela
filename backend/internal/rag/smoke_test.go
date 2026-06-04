package rag

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/zcag/tela/backend/internal/db"
)

// TestSmokeEndToEnd exercises the full chain against a live Ollama: seed pages
// → ReindexSpace (chunk + embed + store) → Search (BM25 + tela_cosine kNN,
// RRF-fused). Gated on TELA_RAG_SMOKE=1 because it needs the network and a
// running embedder; skipped in CI.
//
//	TELA_RAG_SMOKE=1 TELA_RAG_EMBED_URL=http://tardis:11434 \
//	  go test ./internal/rag/ -run TestSmoke -v
func TestSmokeEndToEnd(t *testing.T) {
	if os.Getenv("TELA_RAG_SMOKE") != "1" {
		t.Skip("set TELA_RAG_SMOKE=1 (and TELA_RAG_EMBED_URL) to run the live smoke test")
	}
	cfg := ConfigFromEnv()
	if cfg.EmbedURL == "" {
		t.Fatal("TELA_RAG_EMBED_URL must be set for the smoke test")
	}

	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "smoke.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	if err := db.Migrate(ctx, d); err != nil {
		t.Fatal(err)
	}

	// Minimal fixture: one user, one space they own, three pages.
	mustExec(t, d, `INSERT INTO users(id, username, password_hash) VALUES (1, 'smoke', 'x')`)
	mustExec(t, d, `INSERT INTO spaces(id, name, slug) VALUES (1, 'Smoke', 'smoke')`)
	mustExec(t, d, `INSERT INTO space_members(space_id, user_id, role) VALUES (1, 1, 'owner')`)
	mustExec(t, d, `INSERT INTO pages(id, space_id, title, body) VALUES (1, 1, ?, ?)`,
		"Deploy Runbook",
		"# Deployment\n## Production\nProd runs on archer. To ship a release, ssh archer, cd ~/proj/tela, git pull, then run make up.\n## Rollback\nCheck out the previous git tag and run make up again.")
	mustExec(t, d, `INSERT INTO pages(id, space_id, title, body) VALUES (2, 1, ?, ?)`,
		"Coffee Club",
		"# Coffee\nThe office espresso machine is a Rancilio. Beans are restocked on Mondays.")
	mustExec(t, d, `INSERT INTO pages(id, space_id, title, body) VALUES (3, 1, ?, ?)`,
		"Onboarding",
		"# Onboarding\n## Accounts\nNew hires get a tela login by self-registering and confirming their email.")

	svc := NewService(d, cfg)
	if !svc.Enabled() {
		t.Fatal("service disabled")
	}

	pages, chunks, err := svc.ReindexSpace(ctx, 1)
	if err != nil {
		t.Fatalf("reindex: %v", err)
	}
	t.Logf("indexed %d pages, %d chunks via %s", pages, chunks, cfg.EmbedModel)
	if chunks == 0 {
		t.Fatal("no chunks indexed")
	}

	// Semantic query that shares almost no vocabulary with the source ("how do
	// we release" vs "ship a release / make up") — this is what BM25 alone
	// misses and the vector half should catch.
	hits, err := svc.Search(ctx, 1, "how do we release a new version to production", nil, 5, "hybrid")
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(hits) == 0 {
		t.Fatal("no hits")
	}
	top := hits[0]
	t.Logf("top hit: page=%d %q [%s] score=%.4f :: %s", top.PageID, top.Title, top.HeadingPath, top.Score, top.Snippet)
	if top.PageID != 1 {
		t.Errorf("top hit page = %d, want 1 (Deploy Runbook); full: %+v", top.PageID, hits)
	}
	if !strings.Contains(strings.ToLower(top.Snippet+top.HeadingPath), "prod") {
		t.Errorf("top hit doesn't look deploy-related: %+v", top)
	}

	// Pure-semantic mode must also find it (proves the cosine UDF path alone).
	sem, err := svc.Search(ctx, 1, "shipping software to the live server", nil, 3, "semantic")
	if err != nil {
		t.Fatalf("semantic search: %v", err)
	}
	if len(sem) == 0 || sem[0].PageID != 1 {
		t.Errorf("semantic top hit = %+v, want page 1", sem)
	}
}

func mustExec(t *testing.T, d *sql.DB, q string, args ...any) {
	t.Helper()
	if _, err := d.Exec(q, args...); err != nil {
		t.Fatalf("exec %q: %v", q, err)
	}
}
