package api

import "testing"

func TestReadingMinutes(t *testing.T) {
	cases := []struct {
		name  string
		words int
		want  int
	}{
		{"empty floors at 1", 0, 1},
		{"a few words floors at 1", 10, 1},
		{"exactly one minute", 220, 1},
		{"just over rounds up", 221, 2},
		{"two minutes", 440, 2},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			body := ""
			for range c.words {
				body += "word "
			}
			if got := readingMinutes(body); got != c.want {
				t.Errorf("readingMinutes(%d words) = %d, want %d", c.words, got, c.want)
			}
		})
	}
}

func TestPostExcerpt(t *testing.T) {
	t.Run("author summary in props wins over body", func(t *testing.T) {
		props := map[string]any{"summary": "The hand-written standfirst."}
		got := postExcerpt("# Heading\n\nBody prose that should be ignored.", props, 180)
		if got != "The hand-written standfirst." {
			t.Fatalf("got %q", got)
		}
	})

	t.Run("falls back to body lead, markdown stripped", func(t *testing.T) {
		body := "## Intro\n\nTalking to your **agent** in [Turkish](/x) is `1.8x` dumber.\n\nMore."
		got := postExcerpt(body, map[string]any{}, 180)
		want := "Intro Talking to your agent in Turkish is 1.8x dumber. More."
		if got != want {
			t.Fatalf("got %q\nwant %q", got, want)
		}
	})

	t.Run("drops code fences and images", func(t *testing.T) {
		body := "Lead line.\n\n```go\nfmt.Println(\"x\")\n```\n\n![alt](/p.png) tail."
		got := postExcerpt(body, nil, 180)
		want := "Lead line. tail."
		if got != want {
			t.Fatalf("got %q\nwant %q", got, want)
		}
	})

	t.Run("clips long text on a word boundary with ellipsis", func(t *testing.T) {
		body := "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu"
		got := postExcerpt(body, nil, 20)
		if []rune(got)[len([]rune(got))-1] != '…' {
			t.Fatalf("expected trailing ellipsis, got %q", got)
		}
		if len([]rune(got)) > 21 {
			t.Fatalf("clip exceeded budget: %q (%d runes)", got, len([]rune(got)))
		}
	})

	t.Run("keeps wikilink visible text", func(t *testing.T) {
		got := postExcerpt("See [[page-slug|the other page]] for more.", nil, 180)
		want := "See the other page for more."
		if got != want {
			t.Fatalf("got %q\nwant %q", got, want)
		}
	})
}

func TestPropStrings(t *testing.T) {
	props := map[string]any{"tags": []any{"demo", "", "features", 7}}
	got := propStrings(props, "tags")
	if len(got) != 2 || got[0] != "demo" || got[1] != "features" {
		t.Fatalf("got %v", got)
	}
	if propStrings(map[string]any{}, "tags") != nil {
		t.Fatalf("absent key should be nil")
	}
}
