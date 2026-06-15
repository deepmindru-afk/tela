package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

// GET /api/admin/feedback lists submitted feedback for an instance admin, and is
// 403 for a non-admin.
func TestAdminFeedbackList(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	admin := loginClient(t, ts, "admin", "testpass123")

	// Submit one via the normal write path so there's a row to read back.
	if resp, err := admin.Post(ts.URL+"/api/feedback", "application/json",
		strings.NewReader(`{"subject":"needs dark mode","body":"the editor is too bright"}`)); err != nil {
		t.Fatalf("post feedback: %v", err)
	} else {
		resp.Body.Close()
	}

	resp, err := admin.Get(ts.URL + "/api/admin/feedback")
	if err != nil {
		t.Fatalf("get feedback: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, b)
	}
	var env struct {
		Feedback []feedbackAdminEntry `json:"feedback"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(env.Feedback) != 1 || env.Feedback[0].Subject != "needs dark mode" {
		t.Fatalf("unexpected feedback list: %+v", env.Feedback)
	}
	if env.Feedback[0].Username == nil || *env.Feedback[0].Username != "admin" {
		t.Fatalf("expected username 'admin', got %v", env.Feedback[0].Username)
	}
}

func TestAdminFeedbackForbiddenForNonAdmin(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "bob", "bobpw1234", false)
	bob := loginClient(t, ts, "bob", "bobpw1234")

	resp, err := bob.Get(ts.URL + "/api/admin/feedback")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status=%d want 403", resp.StatusCode)
	}
}

// GET /api/admin/usage returns the instance overview for an admin (totals include
// the seeded user), and is 403 for a non-admin.
func TestAdminUsage(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	admin := loginClient(t, ts, "admin", "testpass123")

	resp, err := admin.Get(ts.URL + "/api/admin/usage")
	if err != nil {
		t.Fatalf("get usage: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, b)
	}
	var out adminUsageOut
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Period == "" || len(out.Period) != 7 {
		t.Fatalf("period=%q want YYYY-MM", out.Period)
	}
	if out.Totals.Users < 1 {
		t.Fatalf("totals.users=%d want >=1", out.Totals.Users)
	}
	if out.Top == nil || out.Gaps == nil {
		t.Fatalf("top/gaps must be non-nil slices: %+v", out)
	}
}

// Submitting feedback raises the admin's unread count on /api/auth/me; opening
// the inbox (POST /seen) clears it.
func TestFeedbackUnseenBadge(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	admin := loginClient(t, ts, "admin", "testpass123")

	if resp, err := admin.Post(ts.URL+"/api/feedback", "application/json",
		strings.NewReader(`{"subject":"x","body":"something to read"}`)); err != nil {
		t.Fatalf("post feedback: %v", err)
	} else {
		resp.Body.Close()
	}

	unseen := func() int {
		resp, err := admin.Get(ts.URL + "/api/auth/me")
		if err != nil {
			t.Fatalf("get me: %v", err)
		}
		defer resp.Body.Close()
		var me struct {
			User struct {
				FeedbackUnseen *int `json:"feedback_unseen"`
			} `json:"user"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
			t.Fatalf("decode me: %v", err)
		}
		if me.User.FeedbackUnseen == nil {
			t.Fatalf("feedback_unseen missing for admin")
		}
		return *me.User.FeedbackUnseen
	}

	if got := unseen(); got < 1 {
		t.Fatalf("unseen after submit = %d, want >=1", got)
	}
	if resp, err := admin.Post(ts.URL+"/api/admin/feedback/seen", "application/json", nil); err != nil {
		t.Fatalf("mark seen: %v", err)
	} else {
		resp.Body.Close()
	}
	if got := unseen(); got != 0 {
		t.Fatalf("unseen after mark-seen = %d, want 0", got)
	}
}

func TestAdminUsageForbiddenForNonAdmin(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "carol", "carolpw12", false)
	carol := loginClient(t, ts, "carol", "carolpw12")

	resp, err := carol.Get(ts.URL + "/api/admin/usage")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status=%d want 403", resp.StatusCode)
	}
}
