package api

import (
	"strings"
	"testing"
)

// The sheet authoring guide = tela preamble + defter's vendored AGENTS.md. Guard
// that both halves are present and the create-a-sheet mechanism (props.sheet) is
// disclosed, so an agent is never left guessing how to make a sheet in tela.
func TestSheetAuthoringGuide(t *testing.T) {
	g := sheetAuthoringGuideText()
	for _, want := range []string{
		"Authoring tela spreadsheets", // tela preamble
		"sheet: true",                 // how to make a sheet
		"defter-style",                // the styling layer
		"the agent contract",          // defter's vendored AGENTS.md heading
	} {
		if !strings.Contains(g, want) {
			t.Fatalf("sheet authoring guide missing %q", want)
		}
	}
	// The embedded contract must be non-trivial (the vendor step ran).
	if len(sheetAuthoringContract) < 1000 {
		t.Fatalf("embedded defter contract looks empty/stale: %d bytes — run `make sheets-gen`", len(sheetAuthoringContract))
	}
	// The tool hint steers the agent to sheets for grid/formula asks.
	if !strings.Contains(sheetAuthoringToolHint(), "sheet=true") {
		t.Fatalf("tool hint doesn't disclose sheet=true: %q", sheetAuthoringToolHint())
	}
}
