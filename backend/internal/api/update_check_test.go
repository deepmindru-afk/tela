package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/zcag/tela/backend/internal/auth"
)

func TestNewerVersion(t *testing.T) {
	cases := []struct {
		latest, current string
		want            bool
	}{
		{"v0.11.0", "0.10.0", true},
		{"0.10.1", "0.10.0", true},
		{"1.0.0", "0.99.9", true},
		{"0.10.0", "0.10.0", false},
		{"0.9.0", "0.10.0", false}, // numeric, not string, comparison
		{"0.11.0", "dev", false},
		{"", "0.10.0", false},
		{"0.11.0-rc1", "0.10.0", true},
	}
	for _, c := range cases {
		if got := newerVersion(c.latest, c.current); got != c.want {
			t.Errorf("newerVersion(%q, %q) = %v, want %v", c.latest, c.current, got, c.want)
		}
	}
}

// The check reads the latest release from updates.telawiki.com, surfaces it to admins on /me and the
// status endpoint, and goes quiet when an admin turns it off or the env does.
func TestUpdateCheck_FlowAndOffSwitches(t *testing.T) {
	var sent string
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sent = r.URL.RawQuery
		_, _ = w.Write([]byte(`{"latest":"0.11.0","release_url":"https://github.com/zcag/tela/releases/tag/v0.11.0","published_at":"2026-11-01T00:00:00Z"}`))
	}))
	t.Cleanup(gh.Close)
	prevURL, prevVer := latestReleaseURL, Version
	latestReleaseURL, Version = gh.URL, "0.10.0"
	t.Cleanup(func() { latestReleaseURL, Version = prevURL, prevVer })

	d := newAPITestDB(t)
	srv := New(d)
	srv.managedCloud = false // self-host (tests run under TELA_CLOUD=1)
	adminID := seedUser(t, d, "admin", "adminpw123", true)
	admin := authUser(adminID, "admin", true)

	status := func() updateStatusDTO {
		rec := recordHandler(srv.GetUpdateStatus, userRequest(http.MethodGet, "/api/admin/updates", "", admin))
		var st updateStatusDTO
		_ = json.Unmarshal(rec.Body.Bytes(), &st)
		return st
	}
	sid, err := auth.CreateSession(context.Background(), d, adminID, "test")
	if err != nil {
		t.Fatal(err)
	}
	me := func() string {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
		req.AddCookie(&http.Cookie{Name: auth.CookieName, Value: sid})
		rec := recordHandler(srv.Me, req)
		var out struct {
			User authUserDTO `json:"user"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return out.User.UpdateAvailable
	}

	if st := status(); !st.Applies || !st.Enabled || st.UpdateAvailable {
		t.Fatalf("before a check: %+v", st)
	}
	rec := recordHandler(srv.CheckForUpdate, userRequest(http.MethodPost, "/api/admin/updates/check", "", admin))
	if rec.Code != http.StatusOK {
		t.Fatalf("check: %d %s", rec.Code, rec.Body.String())
	}
	if sent != "version=0.10.0" { // the version and nothing else
		t.Fatalf("check sent %q, want only version=0.10.0", sent)
	}
	if st := status(); !st.UpdateAvailable || st.Latest != "0.11.0" || st.CheckedAt == "" {
		t.Fatalf("after a check: %+v", st)
	}
	if got := me(); got != "0.11.0" {
		t.Fatalf("/me update_available = %q, want 0.11.0", got)
	}

	// Admin turns it off: the notice goes away and checking is refused.
	patch := userRequest(http.MethodPatch, "/api/admin/settings", `{"settings":{"updates.check":"off"}}`, admin)
	if rec := recordHandler(srv.PatchInstanceSettings, patch); rec.Code != http.StatusOK {
		t.Fatalf("patch: %d", rec.Code)
	}
	if st := status(); st.Enabled || st.UpdateAvailable || me() != "" {
		t.Fatalf("turned off but still reporting: %+v", st)
	}
	if rec := recordHandler(srv.CheckForUpdate, userRequest(http.MethodPost, "/api/admin/updates/check", "", admin)); rec.Code != http.StatusConflict {
		t.Fatalf("check while off: %d, want 409", rec.Code)
	}

	// Env off wins over the setting.
	patch = userRequest(http.MethodPatch, "/api/admin/settings", `{"settings":{"updates.check":"on"}}`, admin)
	recordHandler(srv.PatchInstanceSettings, patch)
	t.Setenv("TELA_UPDATE_CHECK", "0")
	if st := status(); st.Enabled || !st.EnvLocked {
		t.Fatalf("env off not honoured: %+v", st)
	}

	// Never on the managed cloud, nor on a dev build (nothing to compare).
	t.Setenv("TELA_UPDATE_CHECK", "")
	srv.managedCloud = true
	if st := status(); st.Applies || st.Enabled {
		t.Fatalf("cloud should not check: %+v", st)
	}
	srv.managedCloud = false
	Version = "dev"
	if st := status(); st.Applies || st.Enabled {
		t.Fatalf("dev build should not check: %+v", st)
	}
}
