package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	dto "github.com/prometheus/client_model/go"
)

func TestRequestLogger_ClientCancelIsNot5xx(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/reqlog-cancel", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	h := requestLogger(mux, mux)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/reqlog-cancel", nil).WithContext(ctx))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/reqlog-cancel", nil))

	route := "GET /api/reqlog-cancel"
	if got := requestCount(t, route, "499"); got != 1 {
		t.Fatalf("499 count=%v want 1", got)
	}
	if got := requestCount(t, route, "500"); got != 1 {
		t.Fatalf("500 count=%v want 1 (only the live request)", got)
	}
}

func requestCount(t *testing.T, route, status string) float64 {
	t.Helper()
	var m dto.Metric
	if err := httpRequests.WithLabelValues("GET", route, status).Write(&m); err != nil {
		t.Fatal(err)
	}
	return m.GetCounter().GetValue()
}
