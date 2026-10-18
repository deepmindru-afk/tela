package rag

import (
	"context"
	"errors"
	"testing"
)

// errEmbedder always fails Embed — stands in for a reachable-but-unusable
// embedder (e.g. a link that times out on a real embed).
type errEmbedder struct{ fakeEmbedder }

func (e *errEmbedder) Embed(context.Context, string) ([]float32, error) {
	return nil, errors.New("embed timed out")
}

// TestProbeEmbed_ExercisesRealPath proves the health probe does an actual embed
// (not a liveness ping), so a failing embedder is reported down — the signal a
// mere liveness check misses.
func TestProbeEmbed_ExercisesRealPath(t *testing.T) {
	fake := &fakeEmbedder{}
	svc := NewServiceWithEmbedder(nil, fake)
	if err := svc.ProbeEmbed(context.Background()); err != nil {
		t.Fatalf("healthy embedder: want nil, got %v", err)
	}
	if fake.calls != 1 {
		t.Fatalf("probe should do exactly one real embed, got %d calls", fake.calls)
	}

	failing := NewServiceWithEmbedder(nil, &errEmbedder{})
	if err := failing.ProbeEmbed(context.Background()); err == nil {
		t.Fatal("failing embedder: want error, got nil (liveness-style probe would hide this)")
	}
}

// TestProbeEmbed_NotMetered proves probe traffic bypasses the usage-metering
// decorator so background probes never inflate a user's usage.
func TestProbeEmbed_NotMetered(t *testing.T) {
	fake := &fakeEmbedder{}
	svc := NewServiceWithEmbedder(nil, fake)
	var metered int
	svc.SetUsageRecorder(func(string, int) { metered++ })

	if err := svc.ProbeEmbed(context.Background()); err != nil {
		t.Fatalf("probe: %v", err)
	}
	if metered != 0 {
		t.Fatalf("probe embed must not be metered, recorded %d", metered)
	}
}

// TestProbeEmbed_Disabled proves a disabled service reports the disabled sentinel
// rather than panicking on a nil embedder.
func TestProbeEmbed_Disabled(t *testing.T) {
	var svc Service
	if err := svc.ProbeEmbed(context.Background()); !errors.Is(err, errEmbedderDisabled) {
		t.Fatalf("disabled: want errEmbedderDisabled, got %v", err)
	}
}
