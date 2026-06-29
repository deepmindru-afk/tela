package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/zcag/tela/backend/internal/auth"
)

// feedbackEnvelope mirrors the {"feedback": {...}} response shape from
// POST /api/feedback.
type feedbackEnvelope struct {
	Feedback feedbackDTO `json:"feedback"`
}

// TestFeedback_SessionCreate201 — admin session POST returns 201, the row
// lands, and created_by_user_id is stamped (created_by_api_key_id stays NULL
// because there's no bearer in play).
func TestFeedback_SessionCreate201(t *testing.T) {
	ts, d := newWiredServer(t)
	uid := seedUser(t, d, "admin", "testpass123", true)
	c := loginClient(t, ts, "admin", "testpass123")

	resp, err := c.Post(ts.URL+"/api/feedback", "application/json",
		strings.NewReader(`{"subject":"hi","body":"feedback body"}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, b)
	}
	var env feedbackEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if env.Feedback.ID == 0 {
		t.Fatalf("response missing id: %+v", env.Feedback)
	}
	if env.Feedback.Subject != "hi" || env.Feedback.Body != "feedback body" {
		t.Fatalf("subject/body roundtrip mismatch: %+v", env.Feedback)
	}
	if env.Feedback.CreatedByUserID == nil || *env.Feedback.CreatedByUserID != uid {
		t.Fatalf("created_by_user_id=%v want %d", env.Feedback.CreatedByUserID, uid)
	}
	if env.Feedback.CreatedByAPIKeyID != nil {
		t.Fatalf("session POST stamped created_by_api_key_id=%v, want nil",
			env.Feedback.CreatedByAPIKeyID)
	}
	if env.Feedback.CreatedAt == "" {
		t.Fatalf("created_at empty, want datetime string")
	}

	// Confirm exactly one row landed.
	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM feedback WHERE id = $1`, env.Feedback.ID).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Fatalf("feedback row count=%d, want 1", n)
	}
}

// TestFeedback_SyntheticOAuthKey — an OAuth-authed MCP caller (claude.ai/cowork)
// carries a synthetic APIKey with no persisted row (ID 0). feedbackCore must NOT
// stamp that into the api_keys FK (it 500'd live before the guard); it records the
// user only, api_key_id NULL.
func TestFeedback_SyntheticOAuthKey(t *testing.T) {
	d := newAPITestDB(t)
	srv := New(d)
	uid := seedUser(t, d, "oauthuser", "testpass123", false)

	k := &auth.APIKey{UserID: uid, Scope: auth.ScopeWrite} // ID 0 → no api_keys row
	dto, ae := srv.feedbackCore(context.Background(), &auth.User{ID: uid}, k,
		feedbackCreateRequest{Subject: "via oauth", Body: "cowork feedback body"}, "mcp", "")
	if ae != nil {
		t.Fatalf("feedbackCore errored for synthetic OAuth key: %+v", ae)
	}
	if dto.CreatedByUserID == nil || *dto.CreatedByUserID != uid {
		t.Fatalf("created_by_user_id=%v want %d", dto.CreatedByUserID, uid)
	}
	if dto.CreatedByAPIKeyID != nil {
		t.Fatalf("synthetic key stamped created_by_api_key_id=%v, want nil", dto.CreatedByAPIKeyID)
	}
}

// TestFeedback_BearerCreate201 — bearer POST returns 201 and stamps BOTH
// created_by_user_id AND created_by_api_key_id. The api_keys row id we
// inserted matches the stamped value end-to-end.
func TestFeedback_BearerCreate201(t *testing.T) {
	t.Setenv("TELA_API_KEY_SECRET", "deadbeef00112233445566778899aabbccddeeff00112233445566778899aabb")
	auth.ResetAPIKeySecretCache()
	ts, d := newWiredServerOnDisk(t)
	uid := seedUser(t, d, "admin", "testpass123", true)

	rawKey, prefix, _, _ := auth.NewAPIKey(auth.LoadAPIKeySecret())
	var keyID int64
	err := d.QueryRowContext(context.Background(), `
		INSERT INTO api_keys (user_id, name, key_prefix, key_hmac, scope, space_id)
		VALUES ($1, 'agent', $2, $3, 'write', NULL) RETURNING id`,
		uid, prefix, auth.HMACAPIKey(auth.LoadAPIKeySecret(), rawKey)).Scan(&keyID)
	if err != nil {
		t.Fatalf("seed key: %v", err)
	}

	resp := bearerRequest(t, http.MethodPost, ts.URL+"/api/feedback", rawKey,
		`{"subject":"bearer test","body":"bearer body"}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, b)
	}
	var env feedbackEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if env.Feedback.CreatedByUserID == nil || *env.Feedback.CreatedByUserID != uid {
		t.Fatalf("created_by_user_id=%v want %d", env.Feedback.CreatedByUserID, uid)
	}
	if env.Feedback.CreatedByAPIKeyID == nil || *env.Feedback.CreatedByAPIKeyID != keyID {
		t.Fatalf("created_by_api_key_id=%v want %d", env.Feedback.CreatedByAPIKeyID, keyID)
	}
}

// TestFeedback_ValidationRejects400 — empty / whitespace-only / oversize
// subject and body all return 400 bad_request before any row is written.
func TestFeedback_ValidationRejects400(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	c := loginClient(t, ts, "admin", "testpass123")

	// NB: an empty/whitespace subject is NOT rejected — it's derived from the
	// body's first line (the single-textarea widget omits the subject). Only an
	// empty body, or an explicitly-supplied oversize subject/body, is a 400.
	cases := []struct {
		name string
		body string
	}{
		{"empty body", `{"subject":"x","body":""}`},
		{"both empty", `{"subject":"","body":""}`},
		{"whitespace body", `{"subject":"x","body":"   "}`},
		{"oversize subject", `{"subject":"` + strings.Repeat("a", 201) + `","body":"x"}`},
		{"oversize body", `{"subject":"x","body":"` + strings.Repeat("a", 8001) + `"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := c.Post(ts.URL+"/api/feedback", "application/json",
				strings.NewReader(tc.body))
			if err != nil {
				t.Fatalf("post: %v", err)
			}
			b, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("status=%d want 400 (body=%s)", resp.StatusCode, b)
			}
			if !strings.Contains(string(b), `"code":"bad_request"`) {
				t.Fatalf("body=%s missing bad_request envelope", b)
			}
		})
	}

	// No rows should have landed despite the 7 failed attempts.
	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM feedback`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Fatalf("feedback row count=%d after validation failures, want 0", n)
	}
}

// TestFeedback_DerivesSubjectAndStampsContext — the widget posts a body, a
// kind, and a client context bag but no subject. The subject is derived from
// the first line, kind persists, source is 'web' (session caller), and the
// backend stamps app_version + the request UA into the context JSONB.
func TestFeedback_DerivesSubjectAndStampsContext(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	c := loginClient(t, ts, "admin", "testpass123")

	payload := `{"body":"Dark mode flickers\nsecond line of detail","kind":"bug",` +
		`"context":{"route":"/spaces/3/pages/42","page_id":42,"space_id":3,"page_title":"Roadmap","theme":"dark"}}`
	resp, err := c.Post(ts.URL+"/api/feedback", "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, b)
	}
	var env feedbackEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if env.Feedback.Subject != "Dark mode flickers" {
		t.Fatalf("derived subject=%q want first line", env.Feedback.Subject)
	}
	if env.Feedback.Kind == nil || *env.Feedback.Kind != "bug" {
		t.Fatalf("kind=%v want bug", env.Feedback.Kind)
	}
	if env.Feedback.Source != "web" {
		t.Fatalf("source=%q want web", env.Feedback.Source)
	}
	ctx := env.Feedback.Context
	if ctx["route"] != "/spaces/3/pages/42" || ctx["page_title"] != "Roadmap" {
		t.Fatalf("client context not preserved: %+v", ctx)
	}
	// JSON numbers decode to float64 through map[string]any.
	if pid, _ := ctx["page_id"].(float64); pid != 42 {
		t.Fatalf("page_id=%v want 42", ctx["page_id"])
	}
	if ctx["source"] != "web" || ctx["app_version"] == "" || ctx["app_version"] == nil {
		t.Fatalf("app/source not stamped: %+v", ctx)
	}
	if ua, _ := ctx["user_agent"].(string); ua == "" {
		t.Fatalf("user_agent not stamped: %+v", ctx)
	}
}

// TestFeedback_UnknownKindIsNull — a kind outside {idea,bug,other} is dropped
// to NULL rather than stored, so the column stays a clean enum.
func TestFeedback_UnknownKindIsNull(t *testing.T) {
	ts, d := newWiredServer(t)
	seedUser(t, d, "admin", "testpass123", true)
	c := loginClient(t, ts, "admin", "testpass123")

	resp, err := c.Post(ts.URL+"/api/feedback", "application/json",
		strings.NewReader(`{"body":"hello","kind":"rant"}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	var env feedbackEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if env.Feedback.Kind != nil {
		t.Fatalf("kind=%v want nil for unknown value", *env.Feedback.Kind)
	}
}

// TestFeedback_Unauthenticated401 — no session cookie + no Authorization
// header → middleware 401 before the handler is reached.
func TestFeedback_Unauthenticated401(t *testing.T) {
	ts, _ := newWiredServer(t)
	resp, err := http.Post(ts.URL+"/api/feedback", "application/json",
		strings.NewReader(`{"subject":"x","body":"y"}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d want 401 (body=%s)", resp.StatusCode, b)
	}
}

// TestFeedback_BearerAllScopesAccepted — read, write, AND admin scopes all
// 201 on POST /api/feedback. Crucial for the MCP `submit_feedback` tool,
// which is a read-scope tool by design: feedback is observational, so the
// lowest-trust keys must be able to report.
func TestFeedback_BearerAllScopesAccepted(t *testing.T) {
	t.Setenv("TELA_API_KEY_SECRET", "deadbeef00112233445566778899aabbccddeeff00112233445566778899aabb")
	auth.ResetAPIKeySecretCache()
	ts, d := newWiredServerOnDisk(t)
	uid := seedUser(t, d, "admin", "testpass123", true)

	for _, scope := range []string{auth.ScopeRead, auth.ScopeWrite, auth.ScopeAdmin} {
		scope := scope
		t.Run(scope, func(t *testing.T) {
			rawKey, prefix, _, _ := auth.NewAPIKey(auth.LoadAPIKeySecret())
			if _, err := d.ExecContext(context.Background(), `
				INSERT INTO api_keys (user_id, name, key_prefix, key_hmac, scope, space_id)
				VALUES ($1, $2, $3, $4, $5, NULL)`,
				uid, "k-"+scope, prefix,
				auth.HMACAPIKey(auth.LoadAPIKeySecret(), rawKey), scope); err != nil {
				t.Fatalf("seed key: %v", err)
			}
			resp := bearerRequest(t, http.MethodPost, ts.URL+"/api/feedback", rawKey,
				`{"subject":"scope `+scope+`","body":"scope body"}`)
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusCreated {
				b, _ := io.ReadAll(resp.Body)
				t.Fatalf("scope %s status=%d body=%s", scope, resp.StatusCode, b)
			}
		})
	}
}
