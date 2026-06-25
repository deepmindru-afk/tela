package api

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"net/http/httptest"
	"testing"

	"github.com/zcag/tela/backend/internal/auth"
)

func TestParseAccentRGBA(t *testing.T) {
	cases := []struct {
		in   string
		want color.RGBA
		ok   bool
	}{
		{"#3b82f6", color.RGBA{0x3b, 0x82, 0xf6, 0xff}, true},
		{"#FFF", color.RGBA{0xff, 0xff, 0xff, 0xff}, true},
		{"#3b82f6cc", color.RGBA{0x3b, 0x82, 0xf6, 0xff}, true}, // alpha forced opaque
		{"rgb(59, 130, 246)", color.RGBA{59, 130, 246, 0xff}, true},
		{"rgba(59,130,246,0.5)", color.RGBA{59, 130, 246, 0xff}, true},
		{"oklch(60% 0.15 240)", color.RGBA{}, false}, // not parsed → renderer falls back
		{"", color.RGBA{}, false},
		{"chartreuse", color.RGBA{}, false},
		{"#12", color.RGBA{}, false},
		{"rgb(300,0,0)", color.RGBA{}, false}, // out of range
	}
	for _, c := range cases {
		got, ok := parseAccentRGBA(c.in)
		if ok != c.ok || (ok && got != c.want) {
			t.Errorf("parseAccentRGBA(%q) = %v,%v want %v,%v", c.in, got, ok, c.want, c.ok)
		}
	}
}

// solidPNG builds a tiny opaque PNG to stand in for an org logo.
func solidPNG(t *testing.T, w, h int, c color.RGBA) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode logo: %v", err)
	}
	return buf.Bytes()
}

func TestRenderOGCard_Branded(t *testing.T) {
	plain, err := renderOGImage("Quarterly Plan", "Engineering")
	if err != nil {
		t.Fatalf("plain render: %v", err)
	}

	logo, _, err := image.Decode(bytes.NewReader(solidPNG(t, 200, 60, color.RGBA{0xff, 0x66, 0x00, 0xff})))
	if err != nil {
		t.Fatalf("decode logo: %v", err)
	}
	brand := ogBrand{
		name:      "NGSS",
		accent:    color.RGBA{0xff, 0x66, 0x00, 0xff},
		hasAccent: true,
		logo:      logo,
	}
	branded, err := renderOGCard("Quarterly Plan", "Engineering", brand)
	if err != nil {
		t.Fatalf("branded render: %v", err)
	}

	img, err := png.Decode(bytes.NewReader(branded))
	if err != nil {
		t.Fatalf("decode branded png: %v", err)
	}
	if img.Bounds() != image.Rect(0, 0, 1200, 630) {
		t.Fatalf("bounds=%v want 1200x630", img.Bounds())
	}
	if bytes.Equal(plain, branded) {
		t.Fatalf("branded card is byte-identical to the plain card — branding had no effect")
	}
}

func TestOGBrandResolution(t *testing.T) {
	_, d := newWiredServer(t)
	_, srv := HandlerWithServer(d)
	ctx := context.Background()

	orgA := seedOrg(t, d, "Owner Org", "owner-org")
	orgB := seedOrg(t, d, "Host Org", "host-org")
	if _, err := d.ExecContext(ctx,
		`INSERT INTO org_branding (org_id, accent) VALUES ($1, '#112233')`, orgA); err != nil {
		t.Fatalf("seed branding A: %v", err)
	}
	space := seedOrgSpace(t, d, "Docs", "docs", orgA)

	t.Run("loadOGBrand", func(t *testing.T) {
		b := srv.loadOGBrand(ctx, orgA)
		if b.name != "Owner Org" {
			t.Fatalf("name=%q want Owner Org", b.name)
		}
		if !b.hasAccent || b.accent != (color.RGBA{0x11, 0x22, 0x33, 0xff}) {
			t.Fatalf("accent=%v hasAccent=%v want #112233", b.accent, b.hasAccent)
		}
		if b.sig == "" {
			t.Fatalf("brand sig is empty")
		}
	})

	t.Run("zero_org_is_blank", func(t *testing.T) {
		if b := srv.loadOGBrand(ctx, 0); b.name != "" || b.hasAccent || b.sig != "" {
			t.Fatalf("orgID 0 should yield the zero brand, got %+v", b)
		}
	})

	t.Run("owner_org_fallback", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/p/1/og.png", nil) // no OrgContext on the request
		if got := srv.ogBrandOrgID(r, orgA); got != orgA {
			t.Fatalf("ogBrandOrgID=%d want owner %d", got, orgA)
		}
		if got := srv.ogSiteName(r, orgA); got != "Owner Org" {
			t.Fatalf("ogSiteName=%q want Owner Org", got)
		}
	})

	t.Run("request_host_org_wins", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/p/1/og.png", nil)
		r = r.WithContext(auth.WithOrgContext(r.Context(), auth.OrgContext{OrgID: orgB, Host: "ngss.io"}))
		if got := srv.ogBrandOrgID(r, orgA); got != orgB {
			t.Fatalf("ogBrandOrgID=%d want request host org %d (precedence)", got, orgB)
		}
		if got := srv.ogSiteName(r, orgA); got != "Host Org" {
			t.Fatalf("ogSiteName=%q want Host Org", got)
		}
	})

	t.Run("no_org_anywhere_is_tela", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/p/1/og.png", nil)
		if got := srv.ogSiteName(r, 0); got != "tela" {
			t.Fatalf("ogSiteName=%q want tela", got)
		}
	})

	_ = space
}
