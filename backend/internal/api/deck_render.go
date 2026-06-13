package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/zcag/tela/backend/internal/models"
)

// Deck render. A "deck" page's body IS Slidev markdown; the deck render sidecar
// (deck/ — a render-only Slidev service) turns it into per-slide PNGs (Present)
// and PDF/PPTX (export), applying one of tela's themes (chosen per deck via the
// `theme` prop). Mirrors pdf_export.go's gotenberg proxy: the backend never
// renders markdown itself, it proxies the sidecar.
//
//   GET /api/pages/{id}/deck            (session-authed) — render → slide manifest
//   GET /api/deck/d/{renderId}/{file}   (public)         — proxy a rendered asset
//   GET /api/pages/{id}/deck.pdf        (session-authed) — export the deck PDF

const deckRenderTO = 180 * time.Second

// deckBaseURL is the internal address of the deck render sidecar.
func deckBaseURL() string {
	if v := os.Getenv("TELA_DECK_URL"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://deck:3344"
}

// deckTheme reads the per-deck theme from page props (the editor's selector
// writes it). Empty → the sidecar applies its default theme.
func deckTheme(p models.Page) string {
	if v, ok := p.Props["theme"].(string); ok {
		return v
	}
	return ""
}

type deckManifest struct {
	ID     string   `json:"id"`
	Count  int      `json:"count"`
	Theme  string   `json:"theme"`
	Slides []string `json:"slides"`
}

// GetPageDeck (GET /api/pages/{id}/deck): session-authed. Renders the page's
// Slidev markdown to slide images and returns the manifest with image URLs
// proxied under /api/deck.
func (s *Server) GetPageDeck(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(w, r, "id")
	if !ok {
		return
	}
	p, err := selectPageByID(r.Context(), s.DB, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusForbidden, "forbidden", "not a member")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "fetch page failed")
		return
	}
	if _, ok := s.requireMembership(w, r, p.SpaceID); !ok {
		return
	}
	m, err := deckRender(r.Context(), p.Body, deckTheme(p))
	if err != nil {
		writeError(w, http.StatusBadGateway, "deck_render_failed", "could not render deck")
		return
	}
	// Slide URLs come back as /d/<id>/N.png — proxy them through tela.
	for i, sl := range m.Slides {
		m.Slides[i] = "/api/deck" + sl
	}
	noStore(w)
	writeJSON(w, http.StatusOK, m)
}

// ServeDeckAsset (GET /api/deck/d/{renderId}/{file}): PUBLIC (auth.IsPublicPath).
// Proxies a rendered slide image / PDF from the sidecar. Content-addressed +
// immutable — renderId is an unguessable content hash (the /api/diagrams posture).
func (s *Server) ServeDeckAsset(w http.ResponseWriter, r *http.Request) {
	renderID := r.PathValue("renderId")
	file := r.PathValue("file")
	if !deckSafeSeg(renderID) || !deckSafeSeg(file) {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid asset path")
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet,
		deckBaseURL()+"/d/"+renderID+"/"+file, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "request build failed")
		return
	}
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "deck_unavailable", "deck service unavailable")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusNotFound, "not_found", "asset not found")
		return
	}
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, resp.Body)
}

// ExportPageDeckPDF (GET /api/pages/{id}/deck.pdf): session-authed. Exports the
// deck to a downloadable PDF via the sidecar.
func (s *Server) ExportPageDeckPDF(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(w, r, "id")
	if !ok {
		return
	}
	p, err := selectPageByID(r.Context(), s.DB, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusForbidden, "forbidden", "not a member")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "fetch page failed")
		return
	}
	if _, ok := s.requireMembership(w, r, p.SpaceID); !ok {
		return
	}
	pdf, err := deckExport(r.Context(), p.Body, deckTheme(p), "pdf")
	if err != nil {
		writeError(w, http.StatusBadGateway, "deck_render_failed", "could not export deck")
		return
	}
	noStore(w)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", pdfFilename(p.Title)))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdf)
}

// ServeDeckThemes (GET /api/deck/themes): PUBLIC. Proxies the sidecar's theme
// list for the editor's theme selector.
func (s *Server) ServeDeckThemes(w http.ResponseWriter, r *http.Request) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, deckBaseURL()+"/themes", nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "request build failed")
		return
	}
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "deck_unavailable", "deck service unavailable")
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// ── proxy core ──────────────────────────────────────────────────────────────

func deckRender(ctx context.Context, body, theme string) (*deckManifest, error) {
	resp, err := deckPost(ctx, "/render", body, theme)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, deckErr(resp)
	}
	var m deckManifest
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		return nil, err
	}
	return &m, nil
}

func deckExport(ctx context.Context, body, theme, format string) ([]byte, error) {
	resp, err := deckPost(ctx, "/export/"+format, body, theme)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, deckErr(resp)
	}
	return io.ReadAll(resp.Body)
}

func deckPost(ctx context.Context, path, body, theme string) (*http.Response, error) {
	u := deckBaseURL() + path
	if theme != "" {
		u += "?theme=" + url.QueryEscape(theme)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "text/markdown")
	return (&http.Client{Timeout: deckRenderTO}).Do(req)
}

func deckErr(resp *http.Response) error {
	snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	return fmt.Errorf("deck %d: %s", resp.StatusCode, strings.TrimSpace(string(snippet)))
}

// deckSafeSeg bounds a proxied path segment (the sidecar also guards traversal).
func deckSafeSeg(s string) bool {
	if s == "" || len(s) > 64 || strings.Contains(s, "..") {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '.' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}
