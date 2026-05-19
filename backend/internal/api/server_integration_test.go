package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/zcag/tela/backend/internal/auth"
)

// newWiredServer spins up an httptest.Server backed by the canonical
// production handler (api.Handler) — every route + auth.Middleware in one
// piece. Tests assert behaviour end-to-end including the cookie / middleware
// / context plumbing the package-level handler tests skip.
func newWiredServer(t *testing.T) (*httptest.Server, *sql.DB) {
	t.Helper()
	d := newAPITestDB(t)
	ts := httptest.NewServer(Handler(d))
	t.Cleanup(ts.Close)
	return ts, d
}

// loginClient POSTs /api/auth/login and returns an *http.Client whose cookie
// jar carries the resulting session cookie. Subsequent requests from the
// returned client are authenticated as that user.
func loginClient(t *testing.T, ts *httptest.Server, username, password string) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookiejar: %v", err)
	}
	c := &http.Client{Jar: jar}
	body := fmt.Sprintf(`{"username":%q,"password":%q}`, username, password)
	resp, err := c.Post(ts.URL+"/api/auth/login", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("login %s: %v", username, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("login %s: status=%d body=%s", username, resp.StatusCode, b)
	}
	u, _ := url.Parse(ts.URL)
	for _, ck := range jar.Cookies(u) {
		if ck.Name == auth.CookieName && ck.Value != "" {
			return c
		}
	}
	t.Fatalf("login %s: session cookie missing from jar", username)
	return nil
}

// TestIntegration_LoginThenListSpaces — login wires the session cookie
// through middleware to a gated handler. Asserts ListSpaces filters to
// caller's memberships only.
func TestIntegration_LoginThenListSpaces(t *testing.T) {
	ts, d := newWiredServer(t)
	alice := seedUser(t, d, "alice", "alicepw12", false)
	bob := seedUser(t, d, "bob", "bobpw1234", false)
	aliceSpace := seedSpace(t, d, "Alice Space", "alice-space", alice)
	_ = seedSpace(t, d, "Bob Space", "bob-space", bob)

	c := loginClient(t, ts, "alice", "alicepw12")
	resp, err := c.Get(ts.URL + "/api/spaces")
	if err != nil {
		t.Fatalf("get spaces: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, body)
	}
	var got struct {
		Spaces []struct {
			ID int64 `json:"id"`
		} `json:"spaces"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got.Spaces) != 1 || got.Spaces[0].ID != aliceSpace {
		t.Fatalf("got %+v, want one space (id=%d)", got.Spaces, aliceSpace)
	}
}

// TestIntegration_LoginBadPassword locks the "no user-enum leak" promise:
// bad password and missing-user both return the same 401 envelope.
func TestIntegration_LoginBadPassword(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "alice", "alicepw12", false)

	resp, err := http.Post(ts.URL+"/api/auth/login", "application/json",
		strings.NewReader(`{"username":"alice","password":"wrong"}`))
	if err != nil {
		t.Fatalf("post login: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d want 401", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), `"code":"unauthorized"`) ||
		!strings.Contains(string(body), `"error":"invalid credentials"`) {
		t.Fatalf("body=%s missing generic unauthorized envelope", body)
	}
	for _, ck := range resp.Cookies() {
		if ck.Name == auth.CookieName && ck.Value != "" {
			t.Fatalf("login set a session cookie on bad password: %+v", ck)
		}
	}
}

// TestIntegration_AdminEndpointBlockedForNonAdmin proves requireInstanceAdmin
// fires AFTER middleware authn — only reachable when the cookie+context
// plumbing actually attaches the user.
func TestIntegration_AdminEndpointBlockedForNonAdmin(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "alice", "alicepw12", false)

	c := loginClient(t, ts, "alice", "alicepw12")
	resp, err := c.Get(ts.URL + "/api/admin/users")
	if err != nil {
		t.Fatalf("get admin users: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status=%d want 403", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), `"code":"forbidden"`) ||
		!strings.Contains(string(body), `"error":"instance admin required"`) {
		t.Fatalf("body=%s missing forbidden envelope", body)
	}
}

// TestIntegration_AdminPATCH_SelfTargetAndDemoteSibling covers two
// admin-mutation safeguards reachable through the real HTTP stack:
//
//  1. PATCH self → 400 "cannot modify self via admin endpoint".
//  2. PATCH other admin to demote → 200 (last_admin does NOT fire when other
//     active admins still exist).
//
// The `last_admin` 400-path itself is structurally unreachable over real
// HTTP: the safeguard fires only when no other ACTIVE admin remains, but the
// auth middleware rejects inactive users (sessions.is_active=1 check in
// LoadSessionAndSlide), so a caller who could trigger it can never make it
// past authn. The package-level test (admin_users_test.go) covers the guard
// via injected fake users; this HTTP test pins the adjacent guards that ARE
// reachable, so a future refactor that breaks them still trips.
func TestIntegration_AdminPATCH_SelfTargetAndDemoteSibling(t *testing.T) {
	ts, d := newWiredServer(t)
	alice := seedUser(t, d, "alice", "alicepw12", true)
	bob := seedUser(t, d, "bob", "bobpw1234", true)

	c := loginClient(t, ts, "alice", "alicepw12")

	// 1. self-target → 400 bad_request.
	resp, err := patchJSON(c, fmt.Sprintf("%s/api/admin/users/%d", ts.URL, alice),
		`{"is_instance_admin":false}`)
	if err != nil {
		t.Fatalf("patch self: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("self-target status=%d want 400", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if !strings.Contains(string(body), `"code":"bad_request"`) ||
		!strings.Contains(string(body), `cannot modify self`) {
		t.Fatalf("self-target body=%s missing self-target guard", body)
	}

	// 2. demote bob (the OTHER admin) → 200, no last_admin fire.
	resp, err = patchJSON(c, fmt.Sprintf("%s/api/admin/users/%d", ts.URL, bob),
		`{"is_instance_admin":false}`)
	if err != nil {
		t.Fatalf("patch bob: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("demote bob status=%d body=%s", resp.StatusCode, b)
	}
	var dto struct {
		User struct {
			IsInstanceAdmin bool `json:"is_instance_admin"`
		} `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&dto); err != nil {
		t.Fatalf("decode demote: %v", err)
	}
	if dto.User.IsInstanceAdmin {
		t.Fatalf("after demote bob.is_instance_admin=true, want false")
	}
}

// TestIntegration_SpaceMember_LastOwnerAndSelfLeave covers the membership
// lifecycle the M6.6 FE hangs on. Two assertions on one fixture:
//
//  1. DELETE /api/spaces/{id}/members/{ownerId} — last owner self-leave →
//     400 last_owner.
//  2. DELETE /api/spaces/{id}/members/{selfId} — non-owner self-leave →
//     204 (and the member row is gone).
func TestIntegration_SpaceMember_LastOwnerAndSelfLeave(t *testing.T) {
	ts, d := newWiredServer(t)
	alice := seedUser(t, d, "alice", "alicepw12", false)
	bob := seedUser(t, d, "bob", "bobpw1234", false)
	space := seedSpace(t, d, "Shared", "shared", alice)
	seedMember(t, d, space, bob, roleViewer)

	// 1. alice (sole owner) tries to self-leave → 400 last_owner.
	aliceC := loginClient(t, ts, "alice", "alicepw12")
	resp, err := deleteReq(aliceC, fmt.Sprintf("%s/api/spaces/%d/members/%d", ts.URL, space, alice))
	if err != nil {
		t.Fatalf("alice self-leave: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("alice self-leave status=%d want 400", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if !strings.Contains(string(body), `"code":"last_owner"`) {
		t.Fatalf("alice self-leave body=%s missing last_owner code", body)
	}

	// 2. bob (viewer) self-leaves → 204, row gone.
	bobC := loginClient(t, ts, "bob", "bobpw1234")
	resp, err = deleteReq(bobC, fmt.Sprintf("%s/api/spaces/%d/members/%d", ts.URL, space, bob))
	if err != nil {
		t.Fatalf("bob self-leave: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("bob self-leave status=%d want 204", resp.StatusCode)
	}
	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM space_members WHERE space_id = ? AND user_id = ?`,
		space, bob).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Fatalf("bob row count=%d after self-leave, want 0", n)
	}
}

// TestIntegration_AuthMe_ReturnsInternalOnDBError covers the M6.7b fix
// (#55) at the HTTP level: a transient DB failure on /api/auth/me must
// surface as 500, not 401 — otherwise the FE evicts the signed-in user
// across a backend hiccup. The unit test in auth_test.go covers the handler
// directly; this test proves the same through the wired stack (middleware
// bypass on /api/auth/*, response written by writeError).
func TestIntegration_AuthMe_ReturnsInternalOnDBError(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "alice", "alicepw12", false)
	c := loginClient(t, ts, "alice", "alicepw12")

	if err := d.Close(); err != nil {
		t.Fatalf("close db: %v", err)
	}
	resp, err := c.Get(ts.URL + "/api/auth/me")
	if err != nil {
		t.Fatalf("get me: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status=%d want 500", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), `"code":"internal"`) {
		t.Fatalf("body=%s missing internal envelope", body)
	}
}

// TestIntegration_GetPage_MissingIdReturnsForbidden covers the M6.7d fix
// (#57) at the HTTP level: a non-member who probes a missing page id must
// see the same 403 a real non-member sees, so the response can't be used to
// enumerate page ids across spaces. Mirrors the handler-level coverage in
// pages_handlers_test.go but through the wired middleware stack.
func TestIntegration_GetPage_MissingIdReturnsForbidden(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "alice", "alicepw12", false)
	c := loginClient(t, ts, "alice", "alicepw12")

	resp, err := c.Get(ts.URL + "/api/pages/99999")
	if err != nil {
		t.Fatalf("get page: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status=%d want 403", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), `"code":"forbidden"`) ||
		!strings.Contains(string(body), `"error":"not a member"`) {
		t.Fatalf("body=%s missing forbidden envelope", body)
	}
}

func patchJSON(c *http.Client, u, body string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPatch, u, strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.Do(req)
}

func deleteReq(c *http.Client, u string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodDelete, u, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}
