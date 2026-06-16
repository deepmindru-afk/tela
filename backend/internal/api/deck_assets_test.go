package api

import "testing"

// Root-relative tela asset URLs in deck markdown must be absolutized for the
// sidecar renderer (which fetches from its own origin); already-absolute and
// external URLs are left alone, and it's a no-op when no canonical base is set.
func TestAbsolutizeDeckAssets(t *testing.T) {
	t.Setenv("TELA_PUBLIC_BASE_URL", "https://tela.example")
	cases := []struct{ in, want string }{
		{"![](/api/files/abc.jpg)", "![](https://tela.example/api/files/abc.jpg)"},
		{"---\nbg: /api/files/abc.jpg\n---", "---\nbg: https://tela.example/api/files/abc.jpg\n---"},
		{`<img src="/api/diagrams/d.svg">`, `<img src="https://tela.example/api/diagrams/d.svg">`},
		{"already https://cdn.example/api/files/x.jpg", "already https://cdn.example/api/files/x.jpg"}, // host-prefixed → untouched
		{"![](https://ext.example/a.png)", "![](https://ext.example/a.png)"},                           // external → untouched
		{"no urls here", "no urls here"},
	}
	for _, c := range cases {
		if got := absolutizeDeckAssets(c.in); got != c.want {
			t.Errorf("absolutizeDeckAssets(%q) = %q, want %q", c.in, got, c.want)
		}
	}
	if got := absolutizeAsset("/api/files/logo.svg"); got != "https://tela.example/api/files/logo.svg" {
		t.Errorf("absolutizeAsset relative = %q", got)
	}
	if got := absolutizeAsset("https://brand.example/logo.svg"); got != "https://brand.example/logo.svg" {
		t.Errorf("absolutizeAsset external should pass through, got %q", got)
	}
}

func TestAbsolutizeDeckAssets_NoBaseIsNoop(t *testing.T) {
	t.Setenv("TELA_PUBLIC_BASE_URL", "")
	in := "![](/api/files/abc.jpg)"
	if got := absolutizeDeckAssets(in); got != in {
		t.Errorf("with no base it must be a no-op, got %q", got)
	}
}
