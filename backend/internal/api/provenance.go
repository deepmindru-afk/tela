package api

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/zcag/tela/backend/internal/auth"
)

// Page provenance — the "who/what last touched this" half of the epistemic read.
// Everything else the reader needs (age, review cadence, corroboration) it already
// has client-side (updated_at, props, the related-pages query); provenance is the
// one signal that lives server-side, in page_revisions. Read-only and computed:
// tela never writes trust metadata into the page, it reports what it observes.

type pageProvenance struct {
	// Coarse class the UI badges on: "human" | "agent" | "sync". Derived from the
	// latest revision's source so a page edited by a person after an agent reads
	// as human again.
	Source string `json:"source"`
	// The raw revision source it was derived from (e.g. "create","edit","agent",
	// "sync","sync-conflict") — for tooltips / debugging.
	RawSource string `json:"raw_source,omitempty"`
	// Username of the last editor, when known (blank for sync/legacy/system rows).
	Editor string `json:"editor,omitempty"`
	// Timestamp of that last revision (falls back to the page's updated_at).
	EditedAt string `json:"edited_at"`
}

// classifyProvenance folds the many revision-source strings into the three classes
// the trust strip distinguishes. Anything that isn't an agent write or a sync
// write is a human edit (create/edit/web/…).
func classifyProvenance(raw string) string {
	switch {
	case raw == "agent":
		return "agent"
	case strings.HasPrefix(raw, "sync"):
		return "sync"
	default:
		return "human"
	}
}

// PageProvenance handles GET /api/pages/{id}/provenance — the latest revision's
// authorship class for the epistemic trust strip. Gated on the same read access
// as GetPage (404/403 collapse so ids can't be probed).
func (s *Server) PageProvenance(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(w, r, "id")
	if !ok {
		return
	}
	u, ok := requireUser(w, r)
	if !ok {
		return
	}
	k, _ := auth.APIKeyFromContext(r.Context())
	p, ae := s.getPageCore(r.Context(), u, k, id)
	if ae != nil {
		writeError(w, ae.Status, ae.Code, ae.Message)
		return
	}

	var rawSource, editor, editedAt sql.NullString
	err := s.DB.QueryRowContext(r.Context(), `
		SELECT r.source, us.username, r.created_at
		  FROM page_revisions r
		  LEFT JOIN users us ON us.id = r.author_id
		 WHERE r.page_id = $1
		 ORDER BY r.id DESC
		 LIMIT 1`, id).Scan(&rawSource, &editor, &editedAt)
	if err != nil && err != sql.ErrNoRows {
		writeError(w, http.StatusInternalServerError, "internal", "provenance lookup failed")
		return
	}
	// No revision (legacy page predating the revision trail) → treat as human,
	// dated to the page's own updated_at.
	when := editedAt.String
	if when == "" {
		when = p.UpdatedAt
	}
	writeJSON(w, http.StatusOK, pageProvenance{
		Source:    classifyProvenance(rawSource.String),
		RawSource: rawSource.String,
		Editor:    editor.String,
		EditedAt:  when,
	})
}
