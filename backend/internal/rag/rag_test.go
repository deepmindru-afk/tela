package rag

import (
	"math"
	"strings"
	"testing"
)

func TestEncodeDecodeRoundTrip(t *testing.T) {
	in := []float32{0, 1, -1, 0.5, 3.14159, -2.71828}
	got := DecodeVector(EncodeVector(in))
	if len(got) != len(in) {
		t.Fatalf("len = %d, want %d", len(got), len(in))
	}
	for i := range in {
		if got[i] != in[i] {
			t.Errorf("elem %d = %v, want %v", i, got[i], in[i])
		}
	}
}

func TestCosineBytes(t *testing.T) {
	a := EncodeVector([]float32{1, 0, 0})
	b := EncodeVector([]float32{1, 0, 0})
	c := EncodeVector([]float32{0, 1, 0})
	d := EncodeVector([]float32{-1, 0, 0})

	if s := cosineBytes(a, b); math.Abs(s-1) > 1e-6 {
		t.Errorf("identical = %v, want 1", s)
	}
	if s := cosineBytes(a, c); math.Abs(s) > 1e-6 {
		t.Errorf("orthogonal = %v, want 0", s)
	}
	if s := cosineBytes(a, d); math.Abs(s+1) > 1e-6 {
		t.Errorf("opposite = %v, want -1", s)
	}
	// Defensive: length mismatch / empty must not panic.
	if s := cosineBytes(a, EncodeVector([]float32{1, 0})); s != 0 {
		t.Errorf("mismatched length = %v, want 0", s)
	}
	if s := cosineBytes(nil, a); s != 0 {
		t.Errorf("nil = %v, want 0", s)
	}
}

func TestChunkMarkdownHeadingPaths(t *testing.T) {
	body := strings.Join([]string{
		"Intro paragraph before any heading.",
		"",
		"# Deploy",
		"Some deploy overview.",
		"",
		"## Production",
		"Run make up on archer.",
		"",
		"### Rollback",
		"Use the previous tag.",
	}, "\n")

	chunks := ChunkMarkdown("Runbook", body)
	if len(chunks) < 4 {
		t.Fatalf("expected >=4 chunks, got %d: %+v", len(chunks), chunks)
	}

	// Find the rollback chunk and assert its breadcrumb + contextual prefix.
	var rb *Chunk
	for i := range chunks {
		if strings.Contains(chunks[i].Content, "previous tag") {
			rb = &chunks[i]
		}
	}
	if rb == nil {
		t.Fatal("rollback chunk not found")
	}
	if rb.HeadingPath != "Deploy > Production > Rollback" {
		t.Errorf("heading path = %q, want %q", rb.HeadingPath, "Deploy > Production > Rollback")
	}
	if !strings.HasPrefix(rb.EmbedText, "Runbook — Deploy > Production > Rollback") {
		t.Errorf("embed text missing contextual prefix: %q", rb.EmbedText)
	}
}

func TestChunkMarkdownIgnoresHeadingInFence(t *testing.T) {
	body := strings.Join([]string{
		"# Title",
		"text",
		"```sh",
		"# this is a shell comment, not a heading",
		"echo hi",
		"```",
		"more text",
	}, "\n")
	chunks := ChunkMarkdown("P", body)
	if len(chunks) != 1 {
		t.Fatalf("fence comment split into %d chunks, want 1: %+v", len(chunks), chunks)
	}
	if !strings.Contains(chunks[0].Content, "shell comment") {
		t.Errorf("fence body dropped: %q", chunks[0].Content)
	}
}

func TestFTSMatchSanitises(t *testing.T) {
	if got := ftsMatch(`deploy "prod*`); got == "" || strings.Contains(got, "**") {
		t.Errorf("ftsMatch = %q", got)
	}
	if got := ftsMatch("   "); got != "" {
		t.Errorf("blank ftsMatch = %q, want empty", got)
	}
}
