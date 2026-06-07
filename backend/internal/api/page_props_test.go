package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/zcag/tela/backend/internal/models"
)

// decodePage pulls the {"page": …} envelope out of a response body.
func decodePage(t *testing.T, resp *http.Response) models.Page {
	t.Helper()
	defer resp.Body.Close()
	var env struct {
		Page models.Page `json:"page"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode page: %v", err)
	}
	return env.Page
}

func getPageHTTP(t *testing.T, c *http.Client, tsURL string, id int64) models.Page {
	t.Helper()
	resp, err := c.Get(fmt.Sprintf("%s/api/pages/%d", tsURL, id))
	if err != nil {
		t.Fatalf("get page: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("get page: status=%d body=%s", resp.StatusCode, b)
	}
	return decodePage(t, resp)
}

// TestPageProps_CRUD exercises the Phase-1 props lifecycle end to end:
// create with props, body-frontmatter absorption + the body invariant,
// reserved-key drop on the explicit field, Replace update semantics, and a
// props-only update.
func TestPageProps_CRUD(t *testing.T) {
	ts, d := newWiredServer(t)
	admin := seedUser(t, d, "admin", "adminpw12", true)
	space := seedSpace(t, d, "S", "s", admin)
	c := loginClient(t, ts, "admin", "adminpw12")

	mustCreate := func(body string) models.Page {
		t.Helper()
		resp, err := postJSON(c, ts.URL+"/api/pages", body)
		if err != nil {
			t.Fatalf("create: %v", err)
		}
		if resp.StatusCode != http.StatusCreated {
			b, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			t.Fatalf("create: status=%d body=%s", resp.StatusCode, b)
		}
		return decodePage(t, resp)
	}

	t.Run("create with explicit props; reserved keys dropped", func(t *testing.T) {
		p := mustCreate(fmt.Sprintf(
			`{"space_id":%d,"title":"P1","body":"hello","props":{"status":"draft","id":999,"title":"nope"}}`, space))
		got := getPageHTTP(t, c, ts.URL, p.ID)
		if got.Props["status"] != "draft" {
			t.Fatalf("props.status = %v, want draft", got.Props["status"])
		}
		if _, ok := got.Props["id"]; ok {
			t.Fatalf("reserved key id leaked into props: %#v", got.Props)
		}
		if _, ok := got.Props["title"]; ok {
			t.Fatalf("reserved key title leaked into props: %#v", got.Props)
		}
	})

	t.Run("body frontmatter absorbed; body stored pure", func(t *testing.T) {
		p := mustCreate(fmt.Sprintf(
			`{"space_id":%d,"title":"P2","body":"---\nowner: cagdas\n---\n# Heading\n\ntext"}`, space))
		got := getPageHTTP(t, c, ts.URL, p.ID)
		if got.Body != "# Heading\n\ntext" {
			t.Fatalf("body = %q, want frontmatter stripped", got.Body)
		}
		if got.Props["owner"] != "cagdas" {
			t.Fatalf("props.owner = %v, want cagdas (absorbed from body)", got.Props["owner"])
		}
	})

	t.Run("explicit props field wins over body frontmatter", func(t *testing.T) {
		p := mustCreate(fmt.Sprintf(
			`{"space_id":%d,"title":"P3","body":"---\nfrom: body\n---\nx","props":{"from":"field"}}`, space))
		got := getPageHTTP(t, c, ts.URL, p.ID)
		if got.Props["from"] != "field" {
			t.Fatalf("props.from = %v, want field (explicit wins)", got.Props["from"])
		}
	})

	t.Run("update replaces the whole bag", func(t *testing.T) {
		p := mustCreate(fmt.Sprintf(
			`{"space_id":%d,"title":"P4","body":"b","props":{"a":"1","b":"2"}}`, space))
		resp, err := patchJSON(c, fmt.Sprintf("%s/api/pages/%d", ts.URL, p.ID), `{"props":{"a":"9"}}`)
		if err != nil || resp.StatusCode != http.StatusOK {
			t.Fatalf("patch props: err=%v status=%d", err, resp.StatusCode)
		}
		resp.Body.Close()
		got := getPageHTTP(t, c, ts.URL, p.ID)
		if got.Props["a"] != "9" {
			t.Fatalf("props.a = %v, want 9", got.Props["a"])
		}
		if _, ok := got.Props["b"]; ok {
			t.Fatalf("Replace semantics violated: b survived: %#v", got.Props)
		}
	})

	t.Run("props-only update is allowed and leaves body unchanged", func(t *testing.T) {
		p := mustCreate(fmt.Sprintf(`{"space_id":%d,"title":"P5","body":"keep me","props":{}}`, space))
		resp, err := patchJSON(c, fmt.Sprintf("%s/api/pages/%d", ts.URL, p.ID), `{"props":{"k":"v"}}`)
		if err != nil || resp.StatusCode != http.StatusOK {
			t.Fatalf("props-only patch: err=%v status=%d", err, resp.StatusCode)
		}
		resp.Body.Close()
		got := getPageHTTP(t, c, ts.URL, p.ID)
		if got.Props["k"] != "v" {
			t.Fatalf("props.k = %v, want v", got.Props["k"])
		}
		if got.Body != "keep me" {
			t.Fatalf("body changed on props-only update: %q", got.Body)
		}
	})
}
