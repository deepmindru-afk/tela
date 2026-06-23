package api

import (
	"context"
	"net/http"
	"strconv"
	"testing"
)

// The deck SPA route must enforce page-read RBAC (requirePageRead) on every
// request — it serves the full deck incl. speaker notes. Non-members and
// nonexistent pages get 403 (no enumeration); a member passes the gate (then
// hits the sidecar, which is unreachable in tests → 502, proving the gate let it
// through rather than blocking).
func TestDeckSPA_RBAC(t *testing.T) {
	d := newAPITestDB(t)
	srv := New(d)
	ctx := context.Background()

	owner := seedUser(t, d, "owner", "ownerpw123", false)
	outsider := seedUser(t, d, "outsider", "outsiderpw123", false)
	sp := seedSpace(t, d, "Deck Space", "deck-space", owner)
	p, ae := srv.createPageCore(ctx, authUser(owner, "owner", false), nil, pageCreateRequest{
		SpaceID: sp, Title: "D", Body: "---\nlayout: cover\ntitle: X\n---\n", Props: map[string]any{"deck": true},
	}, true)
	if ae != nil {
		t.Fatalf("create deck: %v", ae)
	}
	pat := "/api/pages/" + strconv.FormatInt(p.ID, 10) + "/deck/spa/"
	const route = "GET /api/pages/{id}/deck/spa/{path...}"

	hit := func(path string, u *http.Request) int {
		return routedRecorder(route, srv.ServePageDeckSPA, u).Code
	}
	// non-member → 403
	if c := hit(pat, userRequest(http.MethodGet, pat, "", authUser(outsider, "outsider", false))); c != http.StatusForbidden {
		t.Fatalf("outsider: want 403 got %d", c)
	}
	// nonexistent page → 403 (collapses, no enumeration)
	if c := hit("x", userRequest(http.MethodGet, "/api/pages/999999/deck/spa/", "", authUser(outsider, "outsider", false))); c != http.StatusForbidden {
		t.Fatalf("bogus id: want 403 got %d", c)
	}
	// bad id → 400
	if c := hit("x", userRequest(http.MethodGet, "/api/pages/abc/deck/spa/", "", authUser(outsider, "outsider", false))); c != http.StatusBadRequest {
		t.Fatalf("bad id: want 400 got %d", c)
	}
	// member → gate passes; sidecar unreachable in test → 502
	if c := hit(pat, userRequest(http.MethodGet, pat, "", authUser(owner, "owner", false))); c != http.StatusBadGateway {
		t.Fatalf("owner: want 502 (gate passed, sidecar down) got %d", c)
	}
}
