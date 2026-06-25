package api

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg" // encode the share image; its init also registers the JPEG decoder
	"image/png"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	xdraw "golang.org/x/image/draw"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

// ogShareMaxWidth bounds the deck cover used as a share image. A deck slide
// renders at ~1960×1104 (a ~1.8 MB PNG of a full-bleed, often photographic
// slide) — too heavy for link-preview fetchers that cap the image (WhatsApp
// drops previews over a few hundred KB). Downscaling to 1200-wide + JPEG gets
// it to ~100–150 KB while staying crisp at OG render sizes.
const ogShareMaxWidth = 1200

// OG card layout: a 1200×630 canvas with an 80px inset, drawn against a fixed
// dark-mode palette. RGBs are hardcoded so the renderer never grows a
// tokens-equivalent file or a dependency on the FE's tokens.css.
const (
	ogCanvasWidth   = 1200
	ogCanvasHeight  = 630
	ogMargin        = 80
	ogDrawableWidth = ogCanvasWidth - 2*ogMargin
	ogAccentY       = ogMargin
	ogAccentWidth   = 80
	ogAccentHeight  = 4
	ogTitleSize     = 72
	ogTitleLineH    = 88
	ogSubtitleSize  = 36
	ogFooterSize    = 28
	ogMaxTitleLines = 3
	ogLogoMaxWidth  = 440 // org logo bounding box in the branded card header
	ogLogoMaxHeight = 72
)

// ogAccentTintWeight is how much the org accent bleeds into the dark base
// background on a branded card. Kept low so the surface stays dark and the
// light title/subtitle text remains legible against any accent.
const ogAccentTintWeight = 0.16

var (
	ogBgColor       = color.RGBA{R: 0x0f, G: 0x17, B: 0x2a, A: 0xff}
	ogTitleColor    = color.RGBA{R: 0xf1, G: 0xf5, B: 0xf9, A: 0xff}
	ogSubtitleColor = color.RGBA{R: 0x94, G: 0xa3, B: 0xb8, A: 0xff}
	ogFooterColor   = color.RGBA{R: 0xcb, G: 0xd5, B: 0xe1, A: 0xff}
	ogAccentColor   = color.RGBA{R: 0x3b, G: 0x82, B: 0xf6, A: 0xff}
)

// *opentype.Font is concurrent-safe per its docstring; the per-request
// *opentype.Face wrapper is not, so we keep the parsed fonts here and build
// faces per render in renderOGImage.
var (
	ogBoldFont    *opentype.Font
	ogRegularFont *opentype.Font
)

func init() {
	bold, err := opentype.Parse(gobold.TTF)
	if err != nil {
		panic("og_image: parse gobold: " + err.Error())
	}
	regular, err := opentype.Parse(goregular.TTF)
	if err != nil {
		panic("og_image: parse goregular: " + err.Error())
	}
	ogBoldFont = bold
	ogRegularFont = regular
}

// HandleOGImage returns the share image for a page: a deck's first slide
// (downscaled + JPEG via shrinkShareImage), else the server-rendered 1200×630
// PNG title card.
// Public — middleware bypasses /p/* and this route is NOT UA-gated because
// image fetchers (Slack, Twitter, Discord, link-preview proxies) carry
// arbitrary or empty UAs; blocking them would break the OG card path for half
// the real-world traffic.
func (s *Server) HandleOGImage(w http.ResponseWriter, r *http.Request) {
	raw := r.PathValue("id")
	pageID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || pageID <= 0 {
		writeNotFoundHTML(w)
		return
	}

	var (
		title      string
		spaceName  string
		updatedAt  string
		body       string
		propsRaw   []byte
		spaceID    int64
		ownerOrgID int64 // NULL space.org_id scans as 0 via COALESCE
	)
	err = s.DB.QueryRowContext(r.Context(),
		`SELECT p.title, sp.name, p.updated_at, p.body, p.props, p.space_id, COALESCE(sp.org_id, 0)
		   FROM pages p
		   JOIN spaces sp ON sp.id = p.space_id
		  WHERE p.id = $1 AND p.deleted_at IS NULL`, pageID,
	).Scan(&title, &spaceName, &updatedAt, &body, &propsRaw, &spaceID, &ownerOrgID)
	if errors.Is(err, sql.ErrNoRows) {
		writeNotFoundHTML(w)
		return
	}
	if err != nil {
		slog.Error("og_image: load page", "page_id", pageID, "err", err)
		writeInternalHTML(w)
		return
	}

	// Weak ETag: rendering is deterministic in principle, but font-library bytes
	// can vary across builds, so the weak form is the honest one. Key on the
	// page's updated_at unix second, which bumps on every body/title edit.
	var updatedUnix int64
	if t, perr := time.Parse(sinceLayout, updatedAt); perr == nil {
		updatedUnix = t.Unix()
	}
	// Resolve the org brand (logo/accent/name) for this card. Folding its
	// signature into the ETag busts caches when an org changes its branding.
	brand := s.resolveOGBrand(r, ownerOrgID)
	etag := fmt.Sprintf(`W/"og-%d-%d-%s"`, pageID, updatedUnix, brand.sig)

	if r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.WriteHeader(http.StatusNotModified)
		return
	}

	// A deck's share image is its first slide (its visual identity), for public
	// AND private decks. Best-effort + time-bounded — fall back to the generic card
	// if the cover render is slow or unavailable so crawlers always get something.
	if isDeckBag(decodeProps(propsRaw)) {
		if raw, ct, ok := s.deckCoverPNG(r.Context(), body, decodeProps(propsRaw), spaceID); ok {
			img, ict := shrinkShareImage(raw, ct)
			w.Header().Set("Content-Type", ict)
			w.Header().Set("Cache-Control", "public, max-age=3600")
			w.Header().Set("ETag", etag)
			w.Header().Set("Content-Length", strconv.Itoa(len(img)))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(img)
			return
		}
	}

	pngBytes, err := renderOGCard(title, "in "+spaceName, brand)
	if err != nil {
		slog.Error("og_image: render page", "page_id", pageID, "err", err)
		writeInternalHTML(w)
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("ETag", etag)
	w.Header().Set("Content-Length", strconv.Itoa(len(pngBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pngBytes)
}

// shrinkShareImage downscales a deck cover to a link-preview-friendly size and
// re-encodes it as JPEG (deck slides are photographic — JPEG is far smaller than
// PNG). Returns the bytes + content-type to serve. Best-effort: if decode or
// re-encode fails, or the source is already small enough, it returns the
// original bytes/ct unchanged so the OG path never breaks on an odd cover.
func shrinkShareImage(raw []byte, ct string) ([]byte, string) {
	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return raw, ct
	}
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= 0 || h <= 0 {
		return raw, ct
	}
	// Fit within ogShareMaxWidth, preserving aspect; never upscale.
	dw, dh := w, h
	if w > ogShareMaxWidth {
		dw = ogShareMaxWidth
		dh = h * ogShareMaxWidth / w
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, b, xdraw.Over, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 82}); err != nil {
		return raw, ct
	}
	// Keep the original if our re-encode somehow came out larger (e.g. a tiny
	// source that was already optimally compressed).
	if buf.Len() >= len(raw) {
		return raw, ct
	}
	return buf.Bytes(), "image/jpeg"
}

// renderOGImage paints the unbranded 1200×630 card. Thin wrapper over
// renderOGCard with the zero brand — kept for callers/tests that don't carry an
// org brand. subtitle is rendered verbatim (page cards pass "in <space>").
func renderOGImage(title, subtitle string) ([]byte, error) {
	return renderOGCard(title, subtitle, ogBrand{})
}

// renderOGCard paints a 1200×630 RGBA card and returns PNG-encoded bytes. With
// the zero brand it renders the default dark tela card (blue accent bar, "tela"
// footer); with a brand it tints the background toward the org accent, draws the
// org logo in the header, and footers the org name — the full-brand white-label
// card. Pure function — no DB / no http — so tests can drive it directly.
//
// Builds three opentype.Face values per call because opentype.Face is
// documented as not safe for concurrent use; sharing a Face across goroutines
// races on its internal sfnt.Buffer / vector.Rasterizer / mask. The parsed
// *opentype.Font values are concurrent-safe and live at package scope.
func renderOGCard(title, subtitle string, brand ogBrand) ([]byte, error) {
	titleFace, err := opentype.NewFace(ogBoldFont, &opentype.FaceOptions{
		Size: ogTitleSize, DPI: 72, Hinting: font.HintingFull,
	})
	if err != nil {
		return nil, fmt.Errorf("og: title face: %w", err)
	}
	defer titleFace.Close()

	subtitleFace, err := opentype.NewFace(ogRegularFont, &opentype.FaceOptions{
		Size: ogSubtitleSize, DPI: 72, Hinting: font.HintingFull,
	})
	if err != nil {
		return nil, fmt.Errorf("og: subtitle face: %w", err)
	}
	defer subtitleFace.Close()

	footerFace, err := opentype.NewFace(ogBoldFont, &opentype.FaceOptions{
		Size: ogFooterSize, DPI: 72, Hinting: font.HintingFull,
	})
	if err != nil {
		return nil, fmt.Errorf("og: footer face: %w", err)
	}
	defer footerFace.Close()

	img := image.NewRGBA(image.Rect(0, 0, ogCanvasWidth, ogCanvasHeight))

	// Background: a dark base, tinted toward the org accent when branded. The
	// accent weight is low so the result is always a dark surface — light title
	// text stays legible regardless of which accent an org picked.
	bg := ogBgColor
	if brand.hasAccent {
		bg = tintBg(brand.accent)
	}
	draw.Draw(img, img.Bounds(), &image.Uniform{C: bg}, image.Point{}, draw.Src)

	// Header: the org logo when present (the strongest brand signal), else the
	// accent bar (org accent when branded, default blue otherwise).
	var titleY int
	if brand.logo != nil {
		h := drawLogoFit(img, brand.logo, ogMargin, ogMargin, ogLogoMaxWidth, ogLogoMaxHeight)
		titleY = ogMargin + h + 36 + ogTitleSize
	} else {
		accentColor := ogAccentColor
		if brand.hasAccent {
			accentColor = brand.accent
		}
		accentRect := image.Rect(
			ogMargin, ogAccentY,
			ogMargin+ogAccentWidth, ogAccentY+ogAccentHeight,
		)
		draw.Draw(img, accentRect, &image.Uniform{C: accentColor}, image.Point{}, draw.Src)
		titleY = ogAccentY + ogAccentHeight + 16 + ogTitleSize
	}

	titleLines := wrapLines(titleFace, title, ogDrawableWidth, ogMaxTitleLines)
	titleDrawer := &font.Drawer{
		Dst:  img,
		Src:  &image.Uniform{C: ogTitleColor},
		Face: titleFace,
	}
	for i, line := range titleLines {
		titleDrawer.Dot = fixed.P(ogMargin, titleY+i*ogTitleLineH)
		titleDrawer.DrawString(line)
	}

	sub := truncateToWidth(subtitleFace, subtitle, ogDrawableWidth)
	subtitleY := titleY + (len(titleLines)-1)*ogTitleLineH + 24 + ogSubtitleSize
	subtitleDrawer := &font.Drawer{
		Dst:  img,
		Src:  &image.Uniform{C: ogSubtitleColor},
		Face: subtitleFace,
		Dot:  fixed.P(ogMargin, subtitleY),
	}
	subtitleDrawer.DrawString(sub)

	footer := "tela"
	if brand.name != "" {
		footer = truncateToWidth(footerFace, brand.name, ogDrawableWidth)
	}
	footerY := ogCanvasHeight - ogMargin
	footerDrawer := &font.Drawer{
		Dst:  img,
		Src:  &image.Uniform{C: ogFooterColor},
		Face: footerFace,
		Dot:  fixed.P(ogMargin, footerY),
	}
	footerDrawer.DrawString(footer)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// tintBg mixes an org accent into the dark base background at ogAccentTintWeight,
// yielding a brand-tinted-but-still-dark surface.
func tintBg(accent color.RGBA) color.RGBA {
	mix := func(a, b uint8) uint8 {
		return uint8(float64(a)*ogAccentTintWeight + float64(b)*(1-ogAccentTintWeight))
	}
	return color.RGBA{
		R: mix(accent.R, ogBgColor.R),
		G: mix(accent.G, ogBgColor.G),
		B: mix(accent.B, ogBgColor.B),
		A: 0xff,
	}
}

// drawLogoFit composites a logo into dst at (x,y), scaled to fit within
// maxW×maxH while preserving aspect ratio (never upscaled past the box). Returns
// the drawn height so the caller can place the title below it. Drawn with Over
// so a transparent logo blends onto the tinted background.
func drawLogoFit(dst *image.RGBA, logo image.Image, x, y, maxW, maxH int) int {
	b := logo.Bounds()
	lw, lh := b.Dx(), b.Dy()
	if lw <= 0 || lh <= 0 {
		return 0
	}
	dw, dh := lw, lh
	// Scale down to fit the height, then clamp the width.
	if dh > maxH {
		dw = dw * maxH / dh
		dh = maxH
	}
	if dw > maxW {
		dh = dh * maxW / dw
		dw = maxW
	}
	rect := image.Rect(x, y, x+dw, y+dh)
	xdraw.CatmullRom.Scale(dst, rect, logo, b, xdraw.Over, nil)
	return dh
}

// wrapLines greedily wraps text into at most maxLines lines that fit within
// maxWidth pixels when drawn with face. The final line is suffixed with "…" if
// remaining words would overflow. Whitespace-separated; existing newlines
// inside the input are flattened to single spaces by the upstream caller (page
// title is a single TEXT column with no newline convention).
func wrapLines(face font.Face, text string, maxWidth, maxLines int) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return []string{""}
	}
	if maxLines <= 0 {
		return nil
	}

	words := strings.Fields(text)
	maxFixed := fixed.I(maxWidth)

	lines := make([]string, 0, maxLines)
	cur := ""
	i := 0
	for i < len(words) && len(lines) < maxLines {
		candidate := cur
		if candidate == "" {
			candidate = words[i]
		} else {
			candidate = cur + " " + words[i]
		}
		if font.MeasureString(face, candidate) <= maxFixed {
			cur = candidate
			i++
			continue
		}
		// Adding this word overflowed.
		if cur == "" {
			// A single word longer than the line; force it onto its own line
			// and truncate with ellipsis. Avoid getting stuck.
			lines = append(lines, truncateToWidth(face, words[i], maxWidth))
			i++
			continue
		}
		lines = append(lines, cur)
		cur = ""
	}
	if cur != "" && len(lines) < maxLines {
		lines = append(lines, cur)
		cur = ""
	}

	// Words left over: the final line must collapse them with an ellipsis.
	if i < len(words) {
		if len(lines) == 0 {
			// maxLines was 0 or the very first word didn't fit even truncated.
			return []string{truncateToWidth(face, strings.Join(words[i:], " "), maxWidth)}
		}
		last := lines[len(lines)-1]
		remainder := last + " " + strings.Join(words[i:], " ")
		lines[len(lines)-1] = truncateToWidth(face, remainder, maxWidth)
	}

	return lines
}

// truncateToWidth returns s if it fits within maxWidth, else the longest
// rune-prefix that fits with a trailing "…" appended.
func truncateToWidth(face font.Face, s string, maxWidth int) string {
	maxFixed := fixed.I(maxWidth)
	if font.MeasureString(face, s) <= maxFixed {
		return s
	}
	runes := []rune(s)
	ellipsis := "…"
	for n := len(runes) - 1; n >= 0; n-- {
		candidate := strings.TrimRight(string(runes[:n]), " ") + ellipsis
		if font.MeasureString(face, candidate) <= maxFixed {
			return candidate
		}
	}
	return ellipsis
}
