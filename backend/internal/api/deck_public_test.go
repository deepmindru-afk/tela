package api

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

// Public decks: a deck in a PUBLIC space presents publicly (the live SPA + cover
// routes self-authenticate on visibility), the page DTO + tree expose the deck so
// the reader/cards render it instead of garbled Slidev source, and a PRIVATE
// space's deck is never reachable through the public routes.
func TestPublicDeck(t *testing.T) {
	ts, d := newWiredServer(t)
	alice := seedUser(t, d, "alice", "alicepw12", false)
	pub := seedSpace(t, d, "Field Notes", "field-notes", alice)
	priv := seedSpace(t, d, "Secret", "secret", alice)

	mkDeck := func(space int64) int64 {
		var id int64
		if err := d.QueryRow(`INSERT INTO pages (space_id, parent_id, title, body, position, props)
		     VALUES ($1, NULL, 'My Talk', '---'||chr(10)||'layout: cover'||chr(10)||'title: Hi'||chr(10)||'---'||chr(10), 0, '{"deck":true,"summary":"A short talk."}')
		     RETURNING id`, space).Scan(&id); err != nil {
			t.Fatalf("seed deck: %v", err)
		}
		return id
	}
	pubDeck := mkDeck(pub)
	privDeck := mkDeck(priv)

	aliceC := loginClient(t, ts, "alice", "alicepw12")
	if r, _ := patchJSON(aliceC, fmt.Sprintf("%s/api/spaces/%d", ts.URL, pub), `{"visibility":"public"}`); r.StatusCode != http.StatusOK {
		t.Fatalf("publish status=%d", r.StatusCode)
	}

	anon := &http.Client{}
	get := func(path string) *http.Response {
		t.Helper()
		r, err := anon.Get(ts.URL + path)
		if err != nil {
			t.Fatalf("GET %s: %v", path, err)
		}
		r.Body.Close()
		return r
	}
	getBody := func(path string) string {
		t.Helper()
		r, err := anon.Get(ts.URL + path)
		if err != nil {
			t.Fatalf("GET %s: %v", path, err)
		}
		b, _ := io.ReadAll(r.Body)
		r.Body.Close()
		return string(b)
	}

	// The public page DTO carries the deck's present + cover paths.
	dto := getBody(fmt.Sprintf("/api/public/spaces/%d/pages/%d", pub, pubDeck))
	for _, want := range []string{
		`"deck"`, "present_path", "cover_path",
		fmt.Sprintf("/api/public/spaces/%d/pages/%d/deck/spa/", pub, pubDeck),
	} {
		if !strings.Contains(dto, want) {
			t.Fatalf("public deck DTO missing %q:\n%s", want, dto)
		}
	}

	// The tree marks it as a deck and points the card cover at the cover route,
	// with a clean (summary) excerpt — not mangled Slidev source.
	tree := getBody(fmt.Sprintf("/api/public/spaces/%d/tree", pub))
	for _, want := range []string{
		`"kind":"deck"`, "A short talk.",
		fmt.Sprintf("/api/public/spaces/%d/pages/%d/deck/cover", pub, pubDeck),
	} {
		if !strings.Contains(tree, want) {
			t.Fatalf("public tree deck missing %q:\n%s", want, tree)
		}
	}

	// Present route: the public-space gate PASSES for the public deck → reaches the
	// sidecar (unreachable in tests → 502), proving it let the request through.
	if r := get(fmt.Sprintf("/api/public/spaces/%d/pages/%d/deck/spa/", pub, pubDeck)); r.StatusCode != http.StatusBadGateway {
		t.Fatalf("public deck spa: want 502 (gate passed, sidecar down) got %d", r.StatusCode)
	}
	// A PRIVATE space's deck via the public route → 404 (never leaks).
	if r := get(fmt.Sprintf("/api/public/spaces/%d/pages/%d/deck/spa/", priv, privDeck)); r.StatusCode != http.StatusNotFound {
		t.Fatalf("private deck via public route: want 404 got %d", r.StatusCode)
	}
	if r := get(fmt.Sprintf("/api/public/spaces/%d/pages/%d/deck/cover", priv, privDeck)); r.StatusCode != http.StatusNotFound {
		t.Fatalf("private deck cover via public route: want 404 got %d", r.StatusCode)
	}
}
