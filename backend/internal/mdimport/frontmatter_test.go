package mdimport

import (
	"reflect"
	"testing"
)

func TestStripFrontmatter(t *testing.T) {
	cases := []struct {
		name      string
		in        string
		wantBody  string
		wantTitle string
		wantProps map[string]any
	}{
		{
			name:      "no frontmatter returns content unchanged",
			in:        "# Hello\n\nbody",
			wantBody:  "# Hello\n\nbody",
			wantTitle: "",
			wantProps: nil,
		},
		{
			name:      "parses free-form props and strips block",
			in:        "---\nstatus: draft\nowner: cagdas\ntags: [a, b]\n---\nbody text",
			wantBody:  "body text",
			wantTitle: "",
			wantProps: map[string]any{"status": "draft", "owner": "cagdas", "tags": []any{"a", "b"}},
		},
		{
			name:      "title extracted; reserved keys dropped from bag",
			in:        "---\ntitle: My Page\nid: 999\nslug: hand-edited\ncreated: 2020-01-01\nstatus: live\n---\nbody",
			wantBody:  "body",
			wantTitle: "My Page",
			wantProps: map[string]any{"status": "live"},
		},
		{
			name:      "thematic-break lookalike is NOT frontmatter",
			in:        "---\nsome prose paragraph\n---\nmore",
			wantBody:  "---\nsome prose paragraph\n---\nmore",
			wantTitle: "",
			wantProps: nil,
		},
		{
			name:      "yaml sequence is NOT frontmatter",
			in:        "---\n- one\n- two\n---\nbody",
			wantBody:  "---\n- one\n- two\n---\nbody",
			wantTitle: "",
			wantProps: nil,
		},
		{
			name:      "empty frontmatter block yields empty props",
			in:        "---\n\n---\nbody",
			wantBody:  "body",
			wantTitle: "",
			wantProps: map[string]any{},
		},
		{
			name:      "reserved keys matched case-insensitively",
			in:        "---\nTitle: T\nID: 5\nkeep: true\n---\nb",
			wantBody:  "b",
			wantTitle: "T",
			wantProps: map[string]any{"keep": true},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			body, title, props := StripFrontmatter(c.in)
			if body != c.wantBody {
				t.Errorf("body = %q, want %q", body, c.wantBody)
			}
			if title != c.wantTitle {
				t.Errorf("title = %q, want %q", title, c.wantTitle)
			}
			if !reflect.DeepEqual(props, c.wantProps) {
				t.Errorf("props = %#v, want %#v", props, c.wantProps)
			}
		})
	}
}

func TestFilterReserved(t *testing.T) {
	in := map[string]any{"id": 1, "title": "x", "slug": "s", "created": "d", "status": "live", "tags": []any{"a"}}
	got := FilterReserved(in)
	want := map[string]any{"status": "live", "tags": []any{"a"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("FilterReserved = %#v, want %#v", got, want)
	}
}
