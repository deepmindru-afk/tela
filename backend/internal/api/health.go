package api

import (
	"encoding/json"
	"net/http"
)

func (s *Server) Health(w http.ResponseWriter, r *http.Request) {
	// db is the gating check (liveness). rag is reported for readiness/ops
	// visibility but stays cheap (config check, not a network ping), so frequent
	// health probes never hammer the external embedder.
	rag := "disabled"
	if s.rag.Enabled() {
		rag = "enabled"
	}
	resp := map[string]string{"status": "ok", "db": "ok", "rag": rag}
	w.Header().Set("Content-Type", "application/json")
	if err := s.DB.PingContext(r.Context()); err != nil {
		resp["status"] = "degraded"
		resp["db"] = "error: " + err.Error()
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(resp)
		return
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}
