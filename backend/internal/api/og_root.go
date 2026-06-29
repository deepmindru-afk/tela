package api

import (
	"net/http"
	"strconv"
)

// og_root.go — crawler OG card for the bare apex of an org's white-label custom
// domain (e.g. a bot pasting https://tela.ngss.io/ into Slack). Without it the
// root unfurls as the empty "tela" SPA shell; with it the org gets a branded card
// (logo / accent / name) like every other surface on its domain.
//
// Scoped to custom domains by Caddy: ONLY the org-custom-domain block routes "/"
// (bot-gated) and "/og.png" (all UAs) here. The canonical apex keeps its richer
// marketing-landing OG — its block never sends the root to the backend. Branding
// follows the request host via the OrgContext stamped by hostOrgMiddleware, so a
// request with no org (dev / unknown host) falls back to the generic tela card.
// On auth.IsPublicPath; served to cookieless crawlers, so it self-authenticates.

const ogRootTagline = "Team knowledge base"

// HandleRootOG emits the OG envelope for the white-label apex.
func (s *Server) HandleRootOG(w http.ResponseWriter, r *http.Request) {
	siteName := s.ogSiteName(r, 0)
	origin := s.originFor(r)
	if origin == "" {
		origin = canonicalBaseURL()
	}
	writeOGDoc(w, ogDoc{
		Title:        runeTruncate(siteName, 110),
		Description:  runeTruncate(siteName+" — "+ogRootTagline+".", 200),
		CanonicalURL: origin + "/",
		ImageURL:     origin + "/og.png",
		OGType:       "website",
		SiteName:     siteName,
	})
}

// ogRootChips are the capability pills on the apex card — generic across orgs
// (they describe what every tela space offers), since an org carries no tagline.
var ogRootChips = []string{"Docs", "Search", "Decks"}

// HandleRootOGImage renders the apex card: the org brand lockup (logo or
// mark+name), the "knowledge base" tagline as the headline, capability chips, and
// the domain in accent. The org NAME lives in the lockup, so the headline is the
// tagline (not the name repeated). Served to all UAs (link-preview fetchers carry
// arbitrary UAs). Org-branded via the request's custom-domain org.
func (s *Server) HandleRootOGImage(w http.ResponseWriter, r *http.Request) {
	png, err := renderOGCardOpts(ogCardOpts{
		title:       ogRootTagline,
		chips:       ogRootChips,
		accentLabel: s.ogHost(r),
		brand:       s.resolveOGBrand(r, 0),
	})
	if err != nil {
		writeInternalHTML(w)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Content-Length", strconv.Itoa(len(png)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(png)
}
