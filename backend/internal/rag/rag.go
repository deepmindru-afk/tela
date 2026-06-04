// Package rag is tela's self-contained semantic-retrieval layer: heading-aware
// markdown chunking, pluggable embeddings (Ollama by default), and hybrid
// (BM25 + cosine, RRF-fused) chunk search over the page_chunks table.
//
// It is deliberately isolated from the rest of the backend so we can iterate
// without touching load-bearing code:
//
//   - Nothing in the hot page-save path imports it. Indexing is driven on
//     demand (ReindexSpace / ReindexPage), not from page create/update.
//   - The only schema it owns is page_chunks / page_chunks_fts (migration
//     0019), which no existing query reads.
//   - The only process-global side effect is the tela_cosine UDF registered in
//     vector.go (same mechanism as db.tela_strip_excalidraw).
//
// Wire-in is one field on api.Server plus two routes. When TELA_RAG_EMBED_URL
// is unset the feature no-ops (Enabled()==false; handlers return 503), so it
// ships dark until explicitly configured.
package rag

import (
	"context"
	"database/sql"
	"os"
	"strconv"
)

// Config is the env-driven configuration. EmbedURL empty => feature disabled.
type Config struct {
	EmbedURL   string // Ollama base, e.g. http://tardis:11434
	EmbedModel string // default mxbai-embed-large (1024-d)
	Dim        int    // expected embedding dimension (advisory)
}

// ConfigFromEnv reads TELA_RAG_EMBED_URL / _MODEL / _DIM.
func ConfigFromEnv() Config {
	return Config{
		EmbedURL:   os.Getenv("TELA_RAG_EMBED_URL"),
		EmbedModel: getenv("TELA_RAG_EMBED_MODEL", "mxbai-embed-large"),
		Dim:        atoiDefault(os.Getenv("TELA_RAG_EMBED_DIM"), 1024),
	}
}

// Embedder turns text into a vector. One method, so swapping Ollama for a
// hosted OpenAI-compatible endpoint later is a new file, not a refactor.
type Embedder interface {
	Embed(ctx context.Context, text string) ([]float32, error)
	Model() string
}

// Service bundles the DB handle, config, and the active embedder. A nil
// embedder means the feature is disabled.
type Service struct {
	db  *sql.DB
	cfg Config
	emb Embedder
}

// NewService builds the service from config. It never fails: with no EmbedURL
// the service is constructed disabled so api.Server can hold a non-nil handle
// unconditionally.
func NewService(db *sql.DB, cfg Config) *Service {
	s := &Service{db: db, cfg: cfg}
	if cfg.EmbedURL != "" {
		s.emb = NewOllamaEmbedder(cfg.EmbedURL, cfg.EmbedModel)
	}
	return s
}

// Enabled reports whether an embedder is configured.
func (s *Service) Enabled() bool { return s != nil && s.emb != nil }

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func atoiDefault(s string, def int) int {
	if n, err := strconv.Atoi(s); err == nil && n > 0 {
		return n
	}
	return def
}
