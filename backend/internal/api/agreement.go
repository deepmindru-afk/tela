package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/zcag/tela/backend/internal/agreement"
	"github.com/zcag/tela/backend/internal/auth"
)

// pageAgreementOut is the trust strip's corroboration/contradiction read. Computed
// is false when the background worker hasn't produced a (successful) result yet —
// unconfigured instance, brand-new page, or a page with no close neighbours that
// errored — so the UI shows nothing rather than a misleading zero.
type pageAgreementOut struct {
	Computed    bool                `json:"computed"`
	Corroborate int                 `json:"corroborate"`
	Dispute     int                 `json:"dispute"`
	Disputes    []agreement.Dispute `json:"disputes"`
	ComputedAt  string              `json:"computed_at,omitempty"`
}

// PageAgreement handles GET /api/pages/{id}/agreement — the cached corroboration
// signal for one page. Cheap (a single keyed read; the LLM work happened in the
// background). Gated on the same read access as GetPage; every page named in the
// disputes is in the same space, so a reader who can see this page can follow them.
func (s *Server) PageAgreement(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(w, r, "id")
	if !ok {
		return
	}
	u, ok := requireUser(w, r)
	if !ok {
		return
	}
	k, _ := auth.APIKeyFromContext(r.Context())
	if _, ae := s.getPageCore(r.Context(), u, k, id); ae != nil {
		writeError(w, ae.Status, ae.Code, ae.Message)
		return
	}

	var corroborate, dispute int
	var disputesRaw, computedAt string
	err := s.DB.QueryRowContext(r.Context(), `
		SELECT corroborate, dispute, disputes, computed_at
		  FROM page_agreement WHERE page_id = $1 AND last_error = ''`, id,
	).Scan(&corroborate, &dispute, &disputesRaw, &computedAt)
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusOK, pageAgreementOut{Disputes: []agreement.Dispute{}})
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "agreement lookup failed")
		return
	}
	disputes := []agreement.Dispute{}
	_ = json.Unmarshal([]byte(disputesRaw), &disputes)
	writeJSON(w, http.StatusOK, pageAgreementOut{
		Computed:    true,
		Corroborate: corroborate,
		Dispute:     dispute,
		Disputes:    disputes,
		ComputedAt:  computedAt,
	})
}
