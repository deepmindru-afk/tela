package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

// TestAdminAIUsage_Aggregates — seeds usage rows and asserts the weekly + model
// rollups. Uses recordAIUsage (the real capture helper) via the wired server.
func TestAdminAIUsage_Aggregates(t *testing.T) {
	ts, d, srv := newWiredServerOnDiskWithSrv(t)
	_ = d
	seedUser(t, d, "admin", "testpass123", true)

	srv.recordAIUsage("chat", "gpt-x", 100, 40, 0)
	srv.recordAIUsage("chat", "gpt-x", 50, 10, 0)
	srv.recordAIUsage("embed", "qwen-embed", 200, 0, 0)
	srv.recordAIUsage("image", "flux", 0, 0, 1)

	c := loginClient(t, ts, "admin", "testpass123")
	resp, err := c.Get(ts.URL + "/api/admin/ai-usage")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	var out aiUsageOut
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// All four rows landed this week → one week bucket.
	if len(out.Weeks) != 1 {
		t.Fatalf("weeks=%d want 1: %+v", len(out.Weeks), out.Weeks)
	}
	wk := out.Weeks[0]
	if wk.ChatTokens != 200 { // (100+40)+(50+10)
		t.Fatalf("chat tokens=%d want 200", wk.ChatTokens)
	}
	if wk.EmbedTokens != 200 {
		t.Fatalf("embed tokens=%d want 200", wk.EmbedTokens)
	}
	if wk.Images != 1 {
		t.Fatalf("images=%d want 1", wk.Images)
	}

	// Per-model: gpt-x chat is two calls / 200 tokens.
	var chat *aiUsageModel
	for i := range out.Models {
		if out.Models[i].Model == "gpt-x" {
			chat = &out.Models[i]
		}
	}
	if chat == nil || chat.Tokens != 200 || chat.Calls != 2 {
		t.Fatalf("gpt-x model row wrong: %+v", chat)
	}
}

func TestAdminAIUsage_AdminOnly(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "bob", "testpass123", false)
	c := loginClient(t, ts, "bob", "testpass123")
	resp, err := c.Get(ts.URL + "/api/admin/ai-usage")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status=%d want 403", resp.StatusCode)
	}
}
