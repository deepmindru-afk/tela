package rag

import (
	"regexp"
	"strings"
)

// Chunk is one retrievable unit: a slice of a page's markdown under a heading
// path, plus the text actually embedded (heading-path-prefixed for context).
type Chunk struct {
	Ord         int
	HeadingPath string // "Deploy > Production"
	Content     string // raw markdown slice (stored + returned + lexically indexed)
	EmbedText   string // contextualised text (page title + heading path + content) — what we embed
}

var headingRE = regexp.MustCompile(`^(#{1,6})\s+(.*\S)\s*$`)

// maxChunkChars caps a section before a forced flush. Kept well under the
// embedding model's context window: mxbai-embed-large tops out at 512 tokens
// (~1700 chars of dense markdown), and the contextual prefix (title + heading
// path) is added on top — so 1400 leaves headroom. The embedder also hard-caps
// its input as a backstop (see maxEmbedChars), so an overshooting single line
// can never fail a reindex.
const maxChunkChars = 1400

// minChunkChars is the floor below which a section is too thin to stand alone as
// a retrievable unit. Such a section is heading-dominated: embedded by itself it
// matches any query sharing its heading word while answering nothing (the
// "## Kafka Topics → None." failure — a stub that crowded out the pages that
// actually use Kafka). Below this, a section is merged into an adjacent one
// instead of emitted alone. Conservative on purpose — only true stubs fall under
// it — so the rule lifts retrieval without blurring substantive short sections on
// other corpora.
const minChunkChars = 120

// ChunkMarkdown splits a page body into heading-aware chunks. Each chunk carries
// the heading breadcrumb it lives under; the page title + breadcrumb is folded
// into EmbedText so every embedded chunk is self-contained (contextual
// retrieval). Fenced code blocks are never split and `#` inside a fence is not
// treated as a heading. Callers should StripExcalidrawFences(body) first.
func ChunkMarkdown(pageTitle, body string) []Chunk {
	lines := strings.Split(body, "\n")
	var (
		out      []Chunk
		stack    []string // heading title per level (index 0 = h1)
		buf      []string
		inFence  bool
		fenceTok string
	)

	emit := func(content string) {
		parts := make([]string, 0, len(stack))
		for _, s := range stack {
			if s != "" {
				parts = append(parts, s)
			}
		}
		hp := strings.Join(parts, " > ")
		ctx := pageTitle
		if hp != "" {
			ctx += " — " + hp
		}
		out = append(out, Chunk{
			Ord:         len(out),
			HeadingPath: hp,
			Content:     content,
			EmbedText:   ctx + "\n\n" + content,
		})
	}

	// carry holds a sub-threshold section's text to fold into the NEXT flush, so a
	// thin heading-dominated stub never becomes its own embedded chunk (see
	// minChunkChars). Merge-forward keeps the text in the corpus, lexically and
	// semantically, but without the standalone poison vector.
	carry := ""
	flush := func() {
		content := strings.TrimSpace(strings.Join(buf, "\n"))
		buf = buf[:0]
		if content == "" {
			return
		}
		if carry != "" {
			content = carry + "\n\n" + content
			carry = ""
		}
		if len(content) < minChunkChars {
			carry = content // too thin to stand alone — defer into the next section
			return
		}
		emit(content)
	}

	for _, ln := range lines {
		trimmed := strings.TrimSpace(ln)

		// Track fenced code so heading and length rules ignore fence interiors.
		if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
			tok := trimmed[:3]
			switch {
			case !inFence:
				inFence, fenceTok = true, tok
			case tok == fenceTok:
				inFence = false
			}
			buf = append(buf, ln)
			continue
		}

		if !inFence {
			if m := headingRE.FindStringSubmatch(ln); m != nil {
				flush() // close the current section before starting a new heading
				level := len(m[1])
				title := m[2]
				if level > len(stack) {
					for len(stack) < level-1 {
						stack = append(stack, "")
					}
					stack = append(stack, title)
				} else {
					stack = append(stack[:level-1], title)
				}
				continue
			}
		}

		// A markdown table row starts with `|`; never force-flush mid-table, or a
		// split leaves a single orphaned row (e.g. one cell of a "services using X"
		// registry) that's useless out of context. Headings still break tables;
		// tables don't span them. An over-cap table rides the embedder's
		// shrink-retry (the contextual prefix + leading rows sit at the head).
		inTable := strings.HasPrefix(trimmed, "|")
		buf = append(buf, ln)
		if !inFence && !inTable && bufLen(buf) >= maxChunkChars {
			flush()
		}
	}
	flush()
	// A thin trailing section has nothing to merge forward into; fold it back into
	// the last chunk, or emit it alone if it's the whole (tiny) page.
	if carry != "" {
		if n := len(out); n > 0 {
			out[n-1].Content += "\n\n" + carry
			out[n-1].EmbedText += "\n\n" + carry
		} else {
			emit(carry)
		}
	}
	return out
}

func bufLen(buf []string) int {
	n := 0
	for _, s := range buf {
		n += len(s) + 1
	}
	return n
}

// excalidrawFenceRE matches a complete ```excalidraw fenced block. Recovered
// from the retired SQLite-era tela_strip_excalidraw UDF — page bodies carry
// ```excalidraw\n{json}\n``` fences whose JSON must not pollute the embedded /
// lexically-indexed text. Anatomy: literal ```excalidraw info string (optional
// space-separated metadata), a newline, lazy multi-line body, optional newline,
// closing fence.
var excalidrawFenceRE = regexp.MustCompile("(?s)```excalidraw(?:[ \\t]+[^\\n]*)?\\n.*?\\n?```")

// StripExcalidrawFences removes every ```excalidraw fenced block from src.
func StripExcalidrawFences(src string) string {
	return excalidrawFenceRE.ReplaceAllString(src, "")
}
