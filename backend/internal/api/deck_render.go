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
// (deck/) renders it. The look lives entirely in the slidev-theme-tahta package;
// tela passes only a per-deck visual config (variant/accent/lang, from page
// props). Mirrors pdf_export.go's gotenberg proxy: the backend never renders
// markdown itself, it proxies the sidecar.
//
// Present is the live Slidev SPA (real presenter/overview/drawing), built by the
// sidecar and served page-scoped + membership-gated. PNG/PDF/PPTX stay for export
// + the MCP preview_deck tool + thumbnails.
//
//   GET  /api/pages/{id}/deck/spa/{path...} (gated)  — live interactive SPA (Present)
//   GET  /api/pages/{id}/deck/outline       (gated)  — structure, no render
//   POST /api/pages/{id}/deck/parse         (gated)  — parse a draft (editor outline)
//   GET  /api/pages/{id}/deck.pdf|.pptx      (gated)  — export
//   GET  /api/deck/d/{renderId}/{file}      (public) — a rendered PNG (content-addressed)

const deckRenderTO = 180 * time.Second

// deckBaseURL is the internal address of the deck render sidecar.
func deckBaseURL() string {
	if v := os.Getenv("TELA_DECK_URL"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://deck:3344"
}

// deckConfig is tela's per-deck visual config — the only inputs to the theme.
// The whole look lives in the slidev-theme-tahta package; tela just declares
// which variant (and optional accent/lang).
type deckConfig struct {
	Variant string
	Accent  string
	Lang    string
}

// deckThemeConfig reads the per-deck visual config from page props (the editor's
// selector writes them). Empty values → the sidecar applies tahta defaults.
func deckThemeConfig(p models.Page) deckConfig {
	s := func(k string) string {
		if v, ok := p.Props[k].(string); ok {
			return v
		}
		return ""
	}
	return deckConfig{Variant: s("variant"), Accent: s("accent"), Lang: s("lang")}
}

// deckManifest is the sidecar /render result — static frames for export + the MCP
// preview_deck tool.
type deckManifest struct {
	ID      string   `json:"id"`
	Count   int      `json:"count"`
	Variant string   `json:"variant"`
	Slides  []string `json:"slides"`
}

// requirePageRead is the single gate for page-scoped read routes (deck spa /
// outline / parse / export): resolve {id}, collapse not-found to 403 (no
// enumeration), and require read membership of the page's space. On any failure
// it writes the response and returns ok=false.
func (s *Server) requirePageRead(w http.ResponseWriter, r *http.Request) (models.Page, bool) {
	id, ok := parseIDParam(w, r, "id")
	if !ok {
		return models.Page{}, false
	}
	p, err := selectPageByID(r.Context(), s.DB, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusForbidden, "forbidden", "not a member")
		return models.Page{}, false
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "fetch page failed")
		return models.Page{}, false
	}
	if _, ok := s.requireMembership(w, r, p.SpaceID); !ok {
		return models.Page{}, false
	}
	return p, true
}

// ServePageDeckSPA (GET /api/pages/{id}/deck/spa/{path...}): membership-gated.
// Serves one file of the deck's live interactive Slidev SPA (real presenter /
// overview / drawing). The SPA is built lazily + cached in the sidecar; the
// backend forwards the deck body + the base path it serves under + the requested
// file, and streams the sidecar's response (content-type + cache-control). Every
// asset request passes requirePageRead, so a leaked path can't expose another
// space's deck or its speaker notes.
func (s *Server) ServePageDeckSPA(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requirePageRead(w, r)
	if !ok {
		return
	}
	file := r.PathValue("path") // "" → the sidecar serves index.html
	base := fmt.Sprintf("/api/pages/%d/deck/spa/", p.ID)
	resp, err := deckSPA(r.Context(), p.Body, deckThemeConfig(p), base, file)
	if err != nil {
		writeError(w, http.StatusBadGateway, "deck_unavailable", "deck service unavailable")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusNotFound, "not_found", "not found")
		return
	}
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	if cc := resp.Header.Get("Cache-Control"); cc != "" {
		w.Header().Set("Cache-Control", cc)
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, resp.Body)
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
	p, ok := s.requirePageRead(w, r)
	if !ok {
		return
	}
	pdf, err := deckExport(r.Context(), p.Body, deckThemeConfig(p), "pdf")
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

// ExportPageDeckPPTX (GET /api/pages/{id}/deck.pptx): session-authed. Exports
// the deck to a downloadable PowerPoint via the sidecar.
func (s *Server) ExportPageDeckPPTX(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requirePageRead(w, r)
	if !ok {
		return
	}
	pptx, err := deckExport(r.Context(), p.Body, deckThemeConfig(p), "pptx")
	if err != nil {
		writeError(w, http.StatusBadGateway, "deck_render_failed", "could not export deck")
		return
	}
	noStore(w)
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", pageFileSlug(p.Title)+".pptx"))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pptx)
}

// GetPageDeckOutline (GET /api/pages/{id}/deck/outline): session-authed. Returns
// the deck's structure (slide count, titles, layouts, speaker notes, detected
// features) via the sidecar's /parse — no render, no Chromium. Powers the deck's
// default-view identity and the editor outline.
func (s *Server) GetPageDeckOutline(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requirePageRead(w, r)
	if !ok {
		return
	}
	resp, err := deckPost(r.Context(), "/parse", p.Body, deckConfig{})
	if err != nil {
		writeError(w, http.StatusBadGateway, "deck_unavailable", "deck service unavailable")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusBadGateway, "deck_parse_failed", "could not parse deck")
		return
	}
	noStore(w)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, resp.Body)
}

// PostPageDeckParse (POST /api/pages/{id}/deck/parse): session-authed. Parses
// the DRAFT markdown in the request body (the live editor buffer, not the saved
// page) into deck structure via the sidecar's /parse — no render. Powers the
// live editor outline. Page-scoped so it isn't an open parser proxy; the body is
// the unsaved text, so it can't reuse the saved-body /outline route.
func (s *Server) PostPageDeckParse(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePageRead(w, r); !ok {
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 4<<20)) // decks are markdown; 4MB is ample
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "could not read body")
		return
	}
	resp, err := deckPost(r.Context(), "/parse", string(body), deckConfig{})
	if err != nil {
		writeError(w, http.StatusBadGateway, "deck_unavailable", "deck service unavailable")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusBadGateway, "deck_parse_failed", "could not parse deck")
		return
	}
	noStore(w)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, resp.Body)
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

func deckRender(ctx context.Context, body string, cfg deckConfig) (*deckManifest, error) {
	resp, err := deckPost(ctx, "/render", body, cfg)
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

func deckExport(ctx context.Context, body string, cfg deckConfig, format string) ([]byte, error) {
	resp, err := deckPost(ctx, "/export/"+format, body, cfg)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, deckErr(resp)
	}
	return io.ReadAll(resp.Body)
}

// deckSPA fetches one file of the deck's built interactive SPA from the sidecar
// (build-if-needed, cached). `base` is the page-scoped path the SPA is served
// under (baked into the build so asset URLs resolve); `file` is the requested
// asset ("" → index.html).
func deckSPA(ctx context.Context, body string, cfg deckConfig, base, file string) (*http.Response, error) {
	q := deckQuery(cfg)
	q.Set("base", base)
	q.Set("file", file)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, deckBaseURL()+"/spa?"+q.Encode(), strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "text/markdown")
	return (&http.Client{Timeout: deckRenderTO}).Do(req)
}

// deckQuery turns the per-deck visual config into the sidecar's query params.
func deckQuery(cfg deckConfig) url.Values {
	q := url.Values{}
	if cfg.Variant != "" {
		q.Set("variant", cfg.Variant)
	}
	if cfg.Accent != "" {
		q.Set("accent", cfg.Accent)
	}
	if cfg.Lang != "" {
		q.Set("lang", cfg.Lang)
	}
	return q
}

func deckPost(ctx context.Context, path, body string, cfg deckConfig) (*http.Response, error) {
	u := deckBaseURL() + path
	if q := deckQuery(cfg); len(q) > 0 {
		u += "?" + q.Encode()
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
