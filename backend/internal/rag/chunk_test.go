package rag

import (
	"strings"
	"testing"
)

func TestChunkMarkdown_HeadingPath(t *testing.T) {
	// Sections are written above minChunkChars so each stays its own chunk — the
	// heading-path-per-section contract this test guards applies to substantive
	// sections; thin stubs are intentionally merged (see TestChunkMarkdown_ThinSectionMerged).
	body := "intro prose long enough to stand alone as its own retrievable chunk rather than being folded into any neighbouring section, comfortably above the floor.\n\n" +
		"## Deploy\ndeploy stuff described with enough surrounding detail to clear the minimum-chunk-size floor and remain a separate chunk, comfortably above it.\n\n" +
		"### Production\nprod stuff written at sufficient length that the production subsection survives as an independent chunk in the output, comfortably above the floor.\n\n" +
		"## Tests\ntest stuff spelled out fully enough to exceed the thin-section floor and so emit as a fourth distinct chunk on its own, comfortably above the floor.\n"
	chunks := ChunkMarkdown("Runbook", body)
	if len(chunks) != 4 {
		t.Fatalf("want 4 chunks, got %d: %+v", len(chunks), chunks)
	}
	want := []struct{ hp, mustContain string }{
		{"", "intro prose"},
		{"Deploy", "deploy stuff"},
		{"Deploy > Production", "prod stuff"},
		{"Tests", "test stuff"},
	}
	for i, w := range want {
		if chunks[i].HeadingPath != w.hp {
			t.Errorf("chunk %d heading path = %q, want %q", i, chunks[i].HeadingPath, w.hp)
		}
		if chunks[i].Ord != i {
			t.Errorf("chunk %d ord = %d, want %d", i, chunks[i].Ord, i)
		}
	}
	// EmbedText folds in page title + heading path (contextual retrieval).
	if got := chunks[2].EmbedText; !contains(got, "Runbook — Deploy > Production") || !contains(got, "prod stuff") {
		t.Errorf("embed text missing context prefix: %q", got)
	}
}

func TestChunkMarkdown_FenceNotSplitByHeading(t *testing.T) {
	// A `#` inside a code fence must not start a new section.
	body := "## Code\n```sh\n# this is a shell comment, not a heading\necho hi\n```\nafter\n"
	chunks := ChunkMarkdown("P", body)
	if len(chunks) != 1 {
		t.Fatalf("want 1 chunk (fence kept whole), got %d: %+v", len(chunks), chunks)
	}
	if chunks[0].HeadingPath != "Code" {
		t.Errorf("heading path = %q, want Code", chunks[0].HeadingPath)
	}
}

func TestStripExcalidrawFences(t *testing.T) {
	body := "before\n```excalidraw\n{\"type\":\"excalidraw\",\"elements\":[1,2,3]}\n```\nafter"
	got := StripExcalidrawFences(body)
	if contains(got, "elements") || contains(got, "excalidraw") {
		t.Errorf("excalidraw JSON not stripped: %q", got)
	}
	if !contains(got, "before") || !contains(got, "after") {
		t.Errorf("surrounding text lost: %q", got)
	}
}

func TestChunkMarkdown_OversizeSectionSplits(t *testing.T) {
	var big string
	for len(big) < maxChunkChars*2 {
		big += "lorem ipsum dolor sit amet consectetur adipiscing elit\n"
	}
	chunks := ChunkMarkdown("P", "## Big\n"+big)
	if len(chunks) < 2 {
		t.Fatalf("oversize section should split into >=2 chunks, got %d", len(chunks))
	}
	for _, c := range chunks {
		if c.HeadingPath != "Big" {
			t.Errorf("split chunk lost heading path: %q", c.HeadingPath)
		}
	}
}

func TestChunkMarkdown_ThinSectionMerged(t *testing.T) {
	// A thin heading-dominated stub ("## Kafka Topics → None.") must NOT become its
	// own chunk — that's the vector that crowded out the pages actually using Kafka.
	// It merges forward into the next substantive section instead.
	body := "## Purpose\nThis service collects performance counters from network elements over SFTP and writes them into the reporting database for later analysis.\n\n" +
		"## Kafka Topics\nNone. No Kafka dependency in pom.xml.\n\n" +
		"## REST Endpoints\nExposes a single GET endpoint that triggers an on-demand recomputation of the per-site KPI rollups and returns a job id to the caller.\n"
	chunks := ChunkMarkdown("Reporting", body)

	for _, c := range chunks {
		if c.HeadingPath == "Kafka Topics" {
			t.Fatalf("thin 'Kafka Topics' stub emitted as its own chunk: %+v", c)
		}
	}
	// The stub text is not lost — it rode forward into the REST Endpoints chunk.
	var merged bool
	for _, c := range chunks {
		if strings.Contains(c.Content, "No Kafka dependency") && strings.Contains(c.Content, "GET endpoint") {
			merged = true
		}
	}
	if !merged {
		t.Errorf("thin stub text was dropped instead of merged forward: %+v", chunks)
	}
}

func TestChunkMarkdown_SmallTableKeptWhole(t *testing.T) {
	// A table that straddles the maxChunkChars boundary must not be split into an
	// orphaned row — the "services using X" registry is exactly such a table, and a
	// single split-off row was the chunk that produced the wrong answer.
	var b strings.Builder
	b.WriteString("## Services Using Kafka\n")
	for b.Len() < maxChunkChars-100 { // push the table start near the flush boundary
		b.WriteString("Context prose describing the registry that follows below here.\n")
	}
	rows := []string{
		"| service-alpha | 237:9092 |",
		"| service-bravo | 237:9092 |",
		"| service-charlie | 237:9092 |",
		"| service-delta | 237:9092 |",
		"| service-echo | 237:9092 |",
	}
	b.WriteString("\n| Service | Cluster |\n|---|---|\n")
	for _, r := range rows {
		b.WriteString(r + "\n")
	}
	chunks := ChunkMarkdown("Kafka", b.String())

	// Every row must live in the same chunk — find the one holding the first row
	// and assert it holds the last too.
	var holder string
	for _, c := range chunks {
		if strings.Contains(c.Content, rows[0]) {
			holder = c.Content
		}
	}
	if holder == "" {
		t.Fatalf("first table row not found in any chunk")
	}
	for _, r := range rows {
		if !strings.Contains(holder, r) {
			t.Errorf("table split across chunks: row %q not in the chunk holding the first row", r)
		}
	}
}

func contains(s, sub string) bool { return strings.Contains(s, sub) }
