package api

import (
	"strings"
	"testing"
)

// Sample mirrors the shape the deck sidecar serves at /authoring (from
// slidev-theme-tahta's manifests).
func sampleDeckManifest() *deckManifestDoc {
	return &deckManifestDoc{
		Rules: []string{"One idea per slide.", "Do not write CSS or layout HTML."},
		Layouts: []deckLayoutSpec{
			{ID: "cover", UseFor: "title slide", Fields: []deckField{{Name: "title", Required: false}}},
			{ID: "stats", UseFor: "2–4 hero numbers", Fields: []deckField{{Name: "stats", Required: true}}, Example: "layout: stats\nstats:\n  - { value: 80, unit: \"%\" }"},
		},
		Components: []deckComponentSpec{{Name: "Stat", UseFor: "big number"}},
		Variants: []deckVariantSpec{
			{ID: "editorial", Label: "Editorial", Scheme: "dark", Description: "serif"},
			{ID: "brutalist", Label: "Brutalist", Scheme: "dark", Description: "mono"},
		},
	}
}

func TestDeckAuthoringGuideMarkdown(t *testing.T) {
	g := deckAuthoringGuideMarkdown(sampleDeckManifest())
	for _, want := range []string{
		"deck: true",          // how to make a deck (page prop)
		"variant",             // style is a page prop
		"`editorial`",         // variant disclosed
		"`stats`",             // layout disclosed
		"stats*",              // required field marked
		"One idea per slide.", // rules included
		"`<Stat>`",            // component disclosed
		"layout: stats",       // per-layout example included
	} {
		if !strings.Contains(g, want) {
			t.Errorf("deck guide missing %q", want)
		}
	}
	// Must steer agents AWAY from theme headmatter (tela injects it).
	if !strings.Contains(g, "Do NOT") {
		t.Error("deck guide should warn against theme/themeConfig in markdown")
	}
}

func TestDeckAuthoringToolHint(t *testing.T) {
	h := deckAuthoringToolHint()
	for _, want := range []string{"deck=true", "tela://deck-authoring-guide"} {
		if !strings.Contains(h, want) {
			t.Errorf("deck tool hint missing %q", want)
		}
	}
}
