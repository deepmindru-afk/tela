package api

import (
	"context"
	"strings"
	"testing"
)

// A deck's body is Slidev markdown: its leading `---...---` is the deck
// headmatter / first slide and must survive ingress verbatim. A normal page's
// leading frontmatter is still stripped into props (the body invariant).
func TestCreatePage_DeckBodyPreservesHeadmatter(t *testing.T) {
	d := newAPITestDB(t)
	srv := New(d)
	ctx := context.Background()
	u := seedUser(t, d, "deckie", "deckpw123", false)
	sp := seedSpace(t, d, "Decks", "decks", u)
	au := authUser(u, "deckie", false)

	deckBody := "---\nlayout: cover\nkicker: K\ntitle: Cover Title\nsubtitle: Sub\n---\n\n---\nlayout: stats\n---\n"

	// Deck: body kept verbatim.
	p, ae := srv.createPageCore(ctx, au, nil, pageCreateRequest{
		SpaceID: sp, Title: "My Deck", Body: deckBody, Props: map[string]any{"deck": true},
	}, true)
	if ae != nil {
		t.Fatalf("create deck: %v", ae)
	}
	for _, want := range []string{"layout: cover", "title: Cover Title", "kicker: K"} {
		if !strings.Contains(p.Body, want) {
			t.Fatalf("deck body lost %q — headmatter was stripped:\n%s", want, p.Body)
		}
	}
	if b, _ := p.Props["deck"].(bool); !b {
		t.Fatalf("deck prop not set: %+v", p.Props)
	}

	// Non-deck: leading frontmatter still absorbed into props, out of the body.
	doc, ae := srv.createPageCore(ctx, au, nil, pageCreateRequest{
		SpaceID: sp, Title: "Doc", Body: "---\nstatus: draft\n---\n\n# Hi\n",
	}, true)
	if ae != nil {
		t.Fatalf("create doc: %v", ae)
	}
	if strings.Contains(doc.Body, "status: draft") {
		t.Fatalf("doc frontmatter not stripped: %q", doc.Body)
	}
	if doc.Props["status"] != "draft" {
		t.Fatalf("doc frontmatter not absorbed into props: %+v", doc.Props)
	}
}
