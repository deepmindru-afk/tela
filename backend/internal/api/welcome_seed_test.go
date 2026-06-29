package api

import (
	"context"
	"net/http"
	"os"
	"strings"
	"testing"
)

// TestMain disables welcome-page seeding for the whole api test package so the
// many space-creation tests keep asserting on exact page sets. The seed test
// below re-enables it on its own server instance.
func TestMain(m *testing.M) {
	os.Setenv("TELA_DISABLE_WELCOME_SEED", "1")
	// The api suite exercises the managed-cloud product, where the account's plan
	// flag is an authoritative entitlement. Self-host mode (plan flag does NOT
	// grant ee features) is covered explicitly in TestEntitledViaLicense, which
	// builds its Server directly and leaves managedCloud at its false zero value.
	os.Setenv("TELA_CLOUD", "1")
	os.Exit(m.Run())
}

func TestCreateSpace_SeedsWelcomePage(t *testing.T) {
	d := newAPITestDB(t)
	srv := New(d)
	srv.seedWelcome = true // re-enable for this test (TestMain turned it off)

	uid := seedUser(t, d, "alice", "alicepw123", false)
	u := authUser(uid, "alice", false)

	rec := routedRecorder("POST /api/spaces", srv.CreateSpace,
		userRequest(http.MethodPost, "/api/spaces", `{"name":"Engineering"}`, u))
	if rec.Code != http.StatusCreated {
		t.Fatalf("create space: code=%d body=%q", rec.Code, rec.Body.String())
	}

	var title, body string
	err := d.QueryRowContext(context.Background(),
		`SELECT title, body FROM pages WHERE space_id = (SELECT id FROM spaces WHERE slug = 'engineering')`).
		Scan(&title, &body)
	if err != nil {
		t.Fatalf("welcome page not found: %v", err)
	}
	if title != "Welcome to Engineering" {
		t.Fatalf("title=%q want 'Welcome to Engineering'", title)
	}
	if !strings.Contains(body, "home of **Engineering**") {
		t.Fatalf("unexpected welcome body: %q", body)
	}
}

func TestCreateSpace_NoSeedWhenDisabled(t *testing.T) {
	d := newAPITestDB(t)
	srv := New(d) // seeding disabled by TestMain's env

	uid := seedUser(t, d, "bob", "bobpw12345", false)
	u := authUser(uid, "bob", false)

	rec := routedRecorder("POST /api/spaces", srv.CreateSpace,
		userRequest(http.MethodPost, "/api/spaces", `{"name":"Ops"}`, u))
	if rec.Code != http.StatusCreated {
		t.Fatalf("create space: code=%d body=%q", rec.Code, rec.Body.String())
	}
	var n int
	if err := d.QueryRowContext(context.Background(),
		`SELECT COUNT(*) FROM pages WHERE space_id = (SELECT id FROM spaces WHERE slug = 'ops')`).Scan(&n); err != nil {
		t.Fatalf("count pages: %v", err)
	}
	if n != 0 {
		t.Fatalf("expected no seeded page when disabled, got %d", n)
	}
}
