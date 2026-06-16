package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
)

// TestClientError_Records204 — an authed POST returns 204 and lands a
// client.error event row with the page target + a detail blob carrying the kind,
// message, and stack.
func TestClientError_Records204(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	c := loginClient(t, ts, "admin", "testpass123")

	body := `{"kind":"collab","message":"sync wedged","stack":"at foo (a.js:1)","url":"https://x/p/9","page_id":9}`
	resp, err := c.Post(ts.URL+"/api/client-errors", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, b)
	}

	var (
		typ        string
		detail     string
		targetKind string
		targetID   int64
	)
	err = d.QueryRow(`SELECT type, detail, target_kind, target_id FROM events WHERE type = $1`, evtClientError).
		Scan(&typ, &detail, &targetKind, &targetID)
	if err != nil {
		t.Fatalf("query event: %v", err)
	}
	if targetKind != "page" || targetID != 9 {
		t.Fatalf("target=%s/%d want page/9", targetKind, targetID)
	}
	for _, want := range []string{"collab", "sync wedged", "at foo (a.js:1)"} {
		if !strings.Contains(detail, want) {
			t.Fatalf("detail %q missing %q", detail, want)
		}
	}
}

// TestClientError_EmptyMessage400 — a report with no message is rejected and
// writes no event.
func TestClientError_EmptyMessage400(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	c := loginClient(t, ts, "admin", "testpass123")

	resp, err := c.Post(ts.URL+"/api/client-errors", "application/json", strings.NewReader(`{"message":"  "}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status=%d want 400", resp.StatusCode)
	}
	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM events WHERE type = $1`, evtClientError).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Fatalf("event rows=%d want 0", n)
	}
}

// TestClientError_Truncates — an over-long stack is stored truncated rather
// than rejected, so a giant report still yields a usable row.
func TestClientError_Truncates(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	c := loginClient(t, ts, "admin", "testpass123")

	bigStack := strings.Repeat("x", clientErrMaxStack+500)
	payload, _ := json.Marshal(map[string]any{"message": "boom", "stack": bigStack})
	resp, err := c.Post(ts.URL+"/api/client-errors", "application/json", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status=%d want 204", resp.StatusCode)
	}

	var detail string
	if err := d.QueryRow(`SELECT detail FROM events WHERE type = $1`, evtClientError).Scan(&detail); err != nil {
		t.Fatalf("query: %v", err)
	}
	if !strings.Contains(detail, "…(truncated)") {
		t.Fatalf("detail not marked truncated")
	}
	// The stored stack must be bounded near the cap (+ the marker + the other
	// fields), not the full half-megabyte the client sent.
	if len(detail) > clientErrMaxStack+200 {
		t.Fatalf("detail len=%d not truncated to ~%d", len(detail), clientErrMaxStack)
	}
}

// TestClientError_RateLimited — past the per-user budget the beacon is throttled
// (429) and stops writing rows, so an error loop can't flood the feed.
func TestClientError_RateLimited(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	c := loginClient(t, ts, "admin", "testpass123")

	got429 := false
	for i := 0; i < clientErrorRateLimit+5; i++ {
		// Distinct messages so the client-side dedup is irrelevant — this is the
		// server budget under test.
		payload, _ := json.Marshal(map[string]any{"message": "loop-" + strconv.Itoa(i)})
		resp, err := c.Post(ts.URL+"/api/client-errors", "application/json", bytes.NewReader(payload))
		if err != nil {
			t.Fatalf("post %d: %v", i, err)
		}
		resp.Body.Close()
		if resp.StatusCode == http.StatusTooManyRequests {
			got429 = true
		}
	}
	if !got429 {
		t.Fatalf("never hit 429 within %d posts", clientErrorRateLimit+5)
	}

	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM events WHERE type = $1`, evtClientError).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n > clientErrorRateLimit {
		t.Fatalf("wrote %d rows, exceeds budget %d", n, clientErrorRateLimit)
	}
}

// TestClientError_RequiresAuth — no session ⇒ 401, per the non-public route.
func TestClientError_RequiresAuth(t *testing.T) {
	ts, _ := newWiredServer(t)
	resp, err := http.Post(ts.URL+"/api/client-errors", "application/json", strings.NewReader(`{"message":"x"}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d want 401", resp.StatusCode)
	}
}
