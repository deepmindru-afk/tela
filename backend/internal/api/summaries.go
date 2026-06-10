package api

import (
	"net/http"
	"strconv"
)

// Auto-summary handlers. Thin wrappers over the internal/summarize Service:
// this file owns auth + HTTP shape, the summarize package owns the logic.
// Auth mirrors the RAG freshness/reindex pair exactly: the status view is
// always 200 with an `enabled` flag (counts are real even when the LLM is
// off), the queue action 503s when unconfigured and requires membership.

// SummariesStatus handles GET /api/summaries/status[?space_id=]
// Without space_id: per-space summary coverage across every space the caller
// can access, plus the active model. With space_id: per-page status within
// that space. Mirrors RAGFreshness.
func (s *Server) SummariesStatus(w http.ResponseWriter, r *http.Request) {
	u, ok := requireUser(w, r)
	if !ok {
		return
	}
	if v := r.URL.Query().Get("space_id"); v != "" {
		spaceID, err := strconv.ParseInt(v, 10, 64)
		if err != nil || spaceID <= 0 {
			writeError(w, http.StatusBadRequest, "bad_request", "space_id must be a positive integer")
			return
		}
		pages, err := s.summarize.SpacePageSummaries(r.Context(), u.ID, spaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "summaries query failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"enabled": s.summarize.Enabled(), "pages": pages})
		return
	}

	spaces, err := s.summarize.SpaceRollup(r.Context(), u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "summaries query failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled": s.summarize.Enabled(),
		"model":   s.summarize.Model(),
		"spaces":  spaces,
	})
}

// SummarizeSpace handles POST /api/spaces/{id}/summarize
// Queues every stale/missing/failed page in the space for (re)generation by
// the background worker. Requires membership (the same gate as RAGReindex);
// async — 202 with the queued count.
func (s *Server) SummarizeSpace(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUser(w, r); !ok {
		return
	}
	if !s.summarize.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "llm_disabled", "managed AI is not configured")
		return
	}
	spaceID, ok := parseIDParam(w, r, "id")
	if !ok {
		return
	}
	if _, ok := s.requireMembership(w, r, spaceID); !ok {
		return
	}

	n, err := s.summarize.QueueStaleSpace(r.Context(), spaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "summarize queue failed")
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"queued": n})
}
