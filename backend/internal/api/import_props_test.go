package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

// TestImport_FrontmatterStoredAsProps locks the headline Phase-1 behavior:
// imported frontmatter is no longer discarded — free-form keys land in
// pages.props, the title seeds via precedence, reserved keys are dropped, and
// the body is stored without the frontmatter block.
func TestImport_FrontmatterStoredAsProps(t *testing.T) {
	ts, d := newWiredServer(t)
	admin := seedUser(t, d, "admin", "adminpw12", true)
	space := seedSpace(t, d, "S", "s", admin)
	c := loginClient(t, ts, "admin", "adminpw12")

	resp, body := postImport(t, c, ts.URL, space, nil, false, []importFilePart{
		{relPath: "doc.md", body: "---\ntitle: Real Title\nstatus: review\ntags: [x, y]\nid: 12345\n---\n# Real Title\n\nthe body\n"},
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d body=%s", resp.StatusCode, body)
	}
	got := decodeImportResp(t, body)
	if got.Summary.Created != 1 || len(got.Pages) != 1 {
		t.Fatalf("summary=%+v pages=%d", got.Summary, len(got.Pages))
	}
	if got.Pages[0].Title != "Real Title" {
		t.Fatalf("title=%q want 'Real Title' (frontmatter seed)", got.Pages[0].Title)
	}

	var dbBody string
	var propsRaw []byte
	if err := d.QueryRow(`SELECT body, props FROM pages WHERE id = $1`, got.Pages[0].ID).
		Scan(&dbBody, &propsRaw); err != nil {
		t.Fatalf("query page: %v", err)
	}
	if want := "# Real Title\n\nthe body\n"; dbBody != want {
		t.Fatalf("body=%q want %q (frontmatter stripped)", dbBody, want)
	}
	var props map[string]any
	if err := json.Unmarshal(propsRaw, &props); err != nil {
		t.Fatalf("unmarshal props: %v", err)
	}
	if props["status"] != "review" {
		t.Fatalf("props.status=%v want review", props["status"])
	}
	tags, ok := props["tags"].([]any)
	if !ok || len(tags) != 2 || tags[0] != "x" {
		t.Fatalf("props.tags=%v want [x y]", props["tags"])
	}
	if _, ok := props["title"]; ok {
		t.Fatalf("reserved key title leaked into props: %#v", props)
	}
	if _, ok := props["id"]; ok {
		t.Fatalf("reserved key id leaked into props: %#v", props)
	}

	// The import-seed revision should capture props too.
	var revProps []byte
	if err := d.QueryRow(
		`SELECT props FROM page_revisions WHERE page_id = $1 ORDER BY id DESC LIMIT 1`,
		got.Pages[0].ID).Scan(&revProps); err != nil {
		t.Fatalf("query revision props: %v", err)
	}
	var rp map[string]any
	if err := json.Unmarshal(revProps, &rp); err != nil {
		t.Fatalf("unmarshal revision props: %v", err)
	}
	if rp["status"] != "review" {
		t.Fatalf("revision props.status=%v want review", rp["status"])
	}
}
