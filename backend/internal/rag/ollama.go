package rag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// OllamaEmbedder calls an Ollama server's /api/embeddings endpoint. "Hosted
// Ollama" in tela's case is tardis on the tailnet (http://tardis:11434), model
// mxbai-embed-large (1024-d). Swapping to a hosted OpenAI-compatible provider
// is a sibling file implementing Embedder, not a change here.
type OllamaEmbedder struct {
	base   string
	model  string
	client *http.Client
}

func NewOllamaEmbedder(base, model string) *OllamaEmbedder {
	return &OllamaEmbedder{
		base:   strings.TrimRight(base, "/"),
		model:  model,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

func (e *OllamaEmbedder) Model() string { return e.model }

func (e *OllamaEmbedder) Embed(ctx context.Context, text string) ([]float32, error) {
	body, _ := json.Marshal(map[string]string{"model": e.model, "prompt": text})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.base+"/api/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama embed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama embed: status %d", resp.StatusCode)
	}

	var out struct {
		Embedding []float32 `json:"embedding"`
		Error     string    `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("ollama decode: %w", err)
	}
	if out.Error != "" {
		return nil, fmt.Errorf("ollama embed: %s", out.Error)
	}
	if len(out.Embedding) == 0 {
		return nil, fmt.Errorf("ollama embed: empty embedding for model %q", e.model)
	}
	return out.Embedding, nil
}
