package db

import (
	"context"
	"strings"
	"testing"
)

func TestStripExcalidrawFences(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "no fence — passes through unchanged",
			in:   "hello world\n\nplain prose without diagrams.",
			want: "hello world\n\nplain prose without diagrams.",
		},
		{
			name: "single fence with multi-line JSON — fully stripped",
			in: "before\n\n```excalidraw\n{\n  \"elements\": [],\n  \"scene_hash\": \"abc12345\"\n}\n```\n\nafter",
			want: "before\n\n\n\nafter",
		},
		{
			name: "fence containing inline backticks (not triple) — still stripped",
			in: "x\n\n```excalidraw\n{\"elements\": [{\"label\": \"a `b` c\"}], \"scene_hash\":\"deadbeef\"}\n```\n\ny",
			want: "x\n\n\n\ny",
		},
		{
			name: "two fences in the same body — both stripped, prose preserved",
			in: "p1\n\n```excalidraw\n{\"scene_hash\":\"11111111\"}\n```\n\np2\n\n```excalidraw\n{\"scene_hash\":\"22222222\"}\n```\n\np3",
			want: "p1\n\n\n\np2\n\n\n\np3",
		},
		{
			name: "fence at EOF without trailing newline — stripped",
			in:   "intro\n\n```excalidraw\n{\"scene_hash\":\"00000000\"}\n```",
			want: "intro\n\n",
		},
		{
			name: "non-excalidraw code blocks NOT stripped",
			in:   "```go\nfunc main() {}\n```\n\n```excalidraw\n{}\n```\n\nend",
			want: "```go\nfunc main() {}\n```\n\n\n\nend",
		},
		{
			name: "info string with trailing whitespace metadata still matched",
			in:   "```excalidraw   \n{}\n```\nrest",
			want: "\nrest",
		},
		{
			name: "longer info string like 'excalidraw-foo' NOT matched",
			in:   "```excalidraw-foo\n{}\n```\nrest",
			want: "```excalidraw-foo\n{}\n```\nrest",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := StripExcalidrawFences(tc.in)
			if got != tc.want {
				t.Errorf("input:\n%q\ngot:\n%q\nwant:\n%q", tc.in, got, tc.want)
			}
		})
	}
}

// Exercise the UDF + the rewritten FTS5 triggers end-to-end: insert a page
// whose body contains an excalidraw fence with JSON full of distinctive
// tokens, then assert that searching for those tokens returns no hits while
// non-fence prose tokens still match.
func TestFTSStripExcalidraw_Integration(t *testing.T) {
	dbPath := t.TempDir() + "/tela.db"
	d, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer d.Close()
	if err := Migrate(context.Background(), d); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	// Seed minimal space + page. Use schema-default values where possible to
	// avoid pulling in higher-package helpers.
	if _, err := d.Exec(`INSERT INTO spaces (name, slug) VALUES ('S','s')`); err != nil {
		t.Fatalf("seed space: %v", err)
	}
	body := strings.Join([]string{
		"This page describes the Foosball protocol.",
		"",
		"```excalidraw",
		`{"elements":[{"label":"Bazquux"}],"scene_hash":"abcdef01"}`,
		"```",
		"",
		"More prose here mentioning Frobnicator.",
	}, "\n")
	if _, err := d.Exec(
		`INSERT INTO pages (space_id, parent_id, title, body, position) VALUES (1, NULL, 'P', ?, 0)`,
		body,
	); err != nil {
		t.Fatalf("seed page: %v", err)
	}

	matchOne := func(term string) int {
		t.Helper()
		var n int
		// Phrase-quote the term so FTS5 operator characters in the test
		// input never matter; we control the corpus here anyway.
		ftsExpr := `"` + term + `"`
		row := d.QueryRow(`SELECT COUNT(*) FROM pages_fts WHERE pages_fts MATCH ?`, ftsExpr)
		if err := row.Scan(&n); err != nil {
			t.Fatalf("count %q: %v", term, err)
		}
		return n
	}

	if n := matchOne("Foosball"); n != 1 {
		t.Errorf("prose token 'Foosball' should match 1 row, got %d", n)
	}
	if n := matchOne("Frobnicator"); n != 1 {
		t.Errorf("prose token 'Frobnicator' should match 1 row, got %d", n)
	}
	if n := matchOne("Bazquux"); n != 0 {
		t.Errorf("excalidraw-fence token 'Bazquux' MUST be stripped from the index, got %d hits", n)
	}
	// scene_hash itself: a distinctive lower-hex token would be searchable if
	// the strip didn't run. Verify a real-world example.
	if n := matchOne("abcdef01"); n != 0 {
		t.Errorf("scene_hash 'abcdef01' MUST be stripped, got %d hits", n)
	}
}
