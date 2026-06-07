package api

import (
	"strings"
	"testing"
)

// The authoring guide + tool hint are generated from the embedded block manifest
// (blocks_gen.json). These assert the embed parsed and the rich blocks an agent
// would otherwise miss actually surface — a regression here means agents go back
// to writing flat pages.
func TestAuthoringManifestLoaded(t *testing.T) {
	if len(authoringBlocks) == 0 {
		t.Fatal("authoringBlocks empty — blocks_gen.json failed to embed/parse")
	}
}

func TestAuthoringGuideCoversRichBlocks(t *testing.T) {
	guide := authoringGuideMarkdown(true)
	// Spot-check the high-signal, tela-specific blocks and their exact syntax.
	for _, want := range []string{
		"# Authoring tela pages",
		"Callout", "> [!NOTE]",
		"Tabs", ":::tabs",
		"Kanban", ":::kanban",
		"Pull quote", ":::quote{cite=",
		"Embed", ":::embed",
		"Mermaid", "```mermaid",
		"Highlight", "==highlighted==",
		"Footnote", "[^1]",
		"Wikilink", "[[Page Title]]",
		"## A worked example",
	} {
		if !strings.Contains(guide, want) {
			t.Errorf("authoring guide missing %q", want)
		}
	}
}

func TestAuthoringGuideExcludesNonAgentBlocks(t *testing.T) {
	// Excalidraw is editor-only (agent:false) — agents can't hand-write its JSON,
	// so it must not appear as an authoring instruction.
	if strings.Contains(authoringGuideMarkdown(true), "```excalidraw") {
		t.Error("authoring guide should not instruct agents to hand-write excalidraw")
	}
}

func TestAuthoringToolHintNamesBlocks(t *testing.T) {
	hint := authoringToolHint()
	for _, want := range []string{"callout", "tabs", "kanban", "tela://authoring-guide"} {
		if !strings.Contains(hint, want) {
			t.Errorf("tool hint missing %q", want)
		}
	}
}
