package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/zcag/tela/backend/internal/llm"
	"github.com/zcag/tela/backend/internal/summarize"
)

// newSummariesServer wires a server with an injected fake completer so the
// summaries routes are Enabled() without a live LLM. Mirrors newRagServer.
func newSummariesServer(t *testing.T) (*httptest.Server, *sql.DB, *Server) {
	t.Helper()
	t.Setenv("TELA_SHARE_SECRET", "tela-test-share-secret-fixed-32-byte!")
	d := newAPITestDB(t)
	h, srv := HandlerWithServer(d)
	l := llm.NewServiceWithCompleter(&fakeCompleter{answer: "A canned summary."})
	srv.llm = l
	srv.summarize = summarize.NewService(d, l)
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)
	return ts, d, srv
}

func TestSummaries_StatusMatchesContract(t *testing.T) {
	ts, d, srv := newSummariesServer(t)
	alice := seedUser(t, d, "alice", "alicepw12", false)
	aSpace := seedSpace(t, d, "Alpha", "alpha", alice)
	fresh := mustPage(t, d, aSpace, "Fresh", "## A\nreal content here")
	_ = mustPage(t, d, aSpace, "Missing", "## B\nnot summarized yet")
	_ = mustPage(t, d, aSpace, "Empty", "  ")

	if _, err := srv.summarize.SummarizePage(context.Background(), fresh, false); err != nil {
		t.Fatalf("seed summary: %v", err)
	}

	c := loginClient(t, ts, "alice", "alicepw12")

	// Rollup shape: {enabled, model, spaces:[{space_id,name,pages,summarized,stale,failed,last_generated}]}.
	resp, err := c.Get(ts.URL + "/api/summaries/status")
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
	var roll struct {
		Enabled bool                       `json:"enabled"`
		Model   string                     `json:"model"`
		Spaces  []summarize.SpaceSummaries `json:"spaces"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&roll); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !roll.Enabled || roll.Model != "fake-llm" {
		t.Errorf("enabled=%v model=%q, want true/fake-llm", roll.Enabled, roll.Model)
	}
	var f *summarize.SpaceSummaries
	for i := range roll.Spaces {
		if roll.Spaces[i].SpaceID == aSpace {
			f = &roll.Spaces[i]
		}
	}
	if f == nil {
		t.Fatal("alpha space missing from rollup")
	}
	if f.Pages != 2 || f.Summarized != 1 || f.Stale != 1 || f.Failed != 0 || f.LastGenerated == "" {
		t.Errorf("rollup = %+v, want pages=2 summarized=1 stale=1 failed=0 + last_generated", *f)
	}

	// Per-page shape: {enabled, pages:[{page_id,title,status,generated_at,model,last_error,updated_at}]}.
	resp2, err := c.Get(ts.URL + "/api/summaries/status?space_id=" + strconv.FormatInt(aSpace, 10))
	if err != nil {
		t.Fatalf("per-page: %v", err)
	}
	defer resp2.Body.Close()
	var per struct {
		Enabled bool                    `json:"enabled"`
		Pages   []summarize.PageSummary `json:"pages"`
	}
	if err := json.NewDecoder(resp2.Body).Decode(&per); err != nil {
		t.Fatalf("decode per-page: %v", err)
	}
	statuses := map[string]string{}
	for _, p := range per.Pages {
		statuses[p.Title] = p.Status
	}
	want := map[string]string{"Fresh": "fresh", "Missing": "missing", "Empty": "empty"}
	for title, w := range want {
		if statuses[title] != w {
			t.Errorf("page %q status = %q, want %q", title, statuses[title], w)
		}
	}
}

func TestSummaries_DisabledShipsDark(t *testing.T) {
	ts, d := newWiredServer(t) // default Handler → llm unconfigured
	_ = seedUser(t, d, "alice", "alicepw12", false)
	c := loginClient(t, ts, "alice", "alicepw12")

	// Status still answers, reporting enabled=false (mirrors freshness).
	resp, err := c.Get(ts.URL + "/api/summaries/status")
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	defer resp.Body.Close()
	var out struct {
		Enabled bool `json:"enabled"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&out) != nil || out.Enabled {
		t.Fatalf("disabled status: code=%d enabled=%v, want 200/false", resp.StatusCode, out.Enabled)
	}

	// The queue action 503s (mirrors reindex).
	resp2, err := c.Post(ts.URL+"/api/spaces/1/summarize", "application/json", nil)
	if err != nil {
		t.Fatalf("summarize: %v", err)
	}
	resp2.Body.Close()
	if resp2.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("summarize status = %d, want 503 when llm unconfigured", resp2.StatusCode)
	}
}

func TestSummaries_AuthMirrorsFreshness(t *testing.T) {
	ts, d, _ := newSummariesServer(t)
	alice := seedUser(t, d, "alice", "alicepw12", false)
	bob := seedUser(t, d, "bob", "bobpw1234", false)
	_ = seedSpace(t, d, "Alpha", "alpha", alice)
	bSpace := seedSpace(t, d, "Bravo", "bravo", bob)
	_ = mustPage(t, d, bSpace, "Secret", "## Plans\nbob's private content")

	// Unauthenticated → 401.
	resp, err := http.Get(ts.URL + "/api/summaries/status")
	if err != nil {
		t.Fatalf("anon status: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anon status = %d, want 401", resp.StatusCode)
	}

	c := loginClient(t, ts, "alice", "alicepw12")

	// Rollup must not leak bob's space.
	resp2, err := c.Get(ts.URL + "/api/summaries/status")
	if err != nil {
		t.Fatalf("rollup: %v", err)
	}
	defer resp2.Body.Close()
	var roll struct {
		Spaces []summarize.SpaceSummaries `json:"spaces"`
	}
	if err := json.NewDecoder(resp2.Body).Decode(&roll); err != nil {
		t.Fatalf("decode: %v", err)
	}
	for _, f := range roll.Spaces {
		if f.SpaceID == bSpace {
			t.Fatalf("LEAK: alice saw bob's space %d in summaries rollup", bSpace)
		}
	}

	// Per-page on bob's space returns an empty list for alice.
	resp3, err := c.Get(ts.URL + "/api/summaries/status?space_id=" + strconv.FormatInt(bSpace, 10))
	if err != nil {
		t.Fatalf("per-page: %v", err)
	}
	defer resp3.Body.Close()
	var per struct {
		Pages []summarize.PageSummary `json:"pages"`
	}
	if err := json.NewDecoder(resp3.Body).Decode(&per); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(per.Pages) != 0 {
		t.Fatalf("LEAK: alice got %d pages of bob's space", len(per.Pages))
	}

	// Queueing bob's space as alice → 403 (same membership gate as reindex).
	resp4, err := c.Post(ts.URL+"/api/spaces/"+strconv.FormatInt(bSpace, 10)+"/summarize", "application/json", nil)
	if err != nil {
		t.Fatalf("summarize: %v", err)
	}
	resp4.Body.Close()
	if resp4.StatusCode != http.StatusForbidden {
		t.Fatalf("non-member summarize = %d, want 403", resp4.StatusCode)
	}
}

func TestSummarizeSpace_QueuesStalePages(t *testing.T) {
	ts, d, srv := newSummariesServer(t)
	srv.summarize.Start(context.Background()) // arm the queue so counts reflect real enqueues
	alice := seedUser(t, d, "alice", "alicepw12", false)
	aSpace := seedSpace(t, d, "Alpha", "alpha", alice)
	_ = mustPage(t, d, aSpace, "One", "## A\nneeds a summary")
	_ = mustPage(t, d, aSpace, "Two", "## B\nalso needs a summary")
	locked := mustPage(t, d, aSpace, "Locked", "## C\nauthor-owned")
	_ = mustPage(t, d, aSpace, "Empty", " ")
	if _, err := d.Exec(`UPDATE pages SET props = '{"summary_lock": true}' WHERE id = $1`, locked); err != nil {
		t.Fatalf("lock: %v", err)
	}

	c := loginClient(t, ts, "alice", "alicepw12")
	resp, err := c.Post(ts.URL+"/api/spaces/"+strconv.FormatInt(aSpace, 10)+"/summarize", "application/json", nil)
	if err != nil {
		t.Fatalf("summarize: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", resp.StatusCode)
	}
	var out struct {
		Queued int `json:"queued"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Queued != 2 {
		t.Fatalf("queued = %d, want 2 (locked + empty excluded)", out.Queued)
	}
}
