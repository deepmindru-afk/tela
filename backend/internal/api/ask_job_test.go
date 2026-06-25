package api

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"
)

// A tailer from 0 replays everything already logged, then live-tails new events,
// and returns cleanly once the job finishes.
func TestAskJob_TailReplaysThenLiveTails(t *testing.T) {
	j := newAskJob("j1", 7)
	j.emit("sources", map[string]any{"n": 1})
	j.emit("token", map[string]string{"t": "hi"})
	go func() {
		j.emit("token", map[string]string{"t": " there"})
		j.emit("done", map[string]any{})
		j.finish()
	}()

	var got []string
	n, err := j.tail(context.Background(), 0, func(name string, _ json.RawMessage) error {
		got = append(got, name)
		return nil
	})
	if err != nil {
		t.Fatalf("tail err: %v", err)
	}
	want := []string{"sources", "token", "token", "done"}
	if n != len(want) {
		t.Fatalf("delivered %d events, want %d (%v)", n, len(want), got)
	}
	for i, w := range want {
		if got[i] != w {
			t.Fatalf("event %d = %q, want %q (%v)", i, got[i], w, got)
		}
	}
}

// A dropped connection (ctx canceled mid-tail) stops that tailer but NOT
// generation: a later reconnect replays the full log from 0, including events
// emitted after the disconnect. This is the backgrounded-Safari resume path.
func TestAskJob_DisconnectThenReconnectReplaysAll(t *testing.T) {
	j := newAskJob("j2", 1)
	j.emit("sources", map[string]any{"n": 1})

	ctx, cancel := context.WithCancel(context.Background())
	delivered := 0
	_, err := j.tail(ctx, 0, func(_ string, _ json.RawMessage) error {
		delivered++
		cancel() // simulate the client vanishing after the first frame
		return nil
	})
	if err == nil {
		t.Fatal("want a context error after disconnect, got nil")
	}
	if delivered != 1 {
		t.Fatalf("first tailer delivered %d, want 1", delivered)
	}

	// Generation keeps going on its own.
	j.emit("token", map[string]string{"t": "answer"})
	j.emit("done", map[string]any{})
	j.finish()

	var got []string
	if _, err := j.tail(context.Background(), 0, func(name string, _ json.RawMessage) error {
		got = append(got, name)
		return nil
	}); err != nil {
		t.Fatalf("reconnect tail err: %v", err)
	}
	want := []string{"sources", "token", "done"}
	if len(got) != len(want) {
		t.Fatalf("reconnect replayed %v, want %v", got, want)
	}
}

// Every concurrent tailer — whether it attaches before or after the events are
// emitted — receives the complete log. Guards the cond/broadcast against lost
// wakeups. Run with -race to exercise the locking.
func TestAskJob_ConcurrentTailersAllSeeEverything(t *testing.T) {
	j := newAskJob("j3", 1)
	const tailers = 6
	const events = 10

	counts := make([]int, tailers)
	var wg sync.WaitGroup
	for k := 0; k < tailers; k++ {
		wg.Add(1)
		go func(k int) {
			defer wg.Done()
			_, _ = j.tail(context.Background(), 0, func(_ string, _ json.RawMessage) error {
				counts[k]++
				return nil
			})
		}(k)
	}

	for i := 0; i < events; i++ {
		j.emit("token", map[string]int{"i": i})
	}
	j.emit("done", map[string]any{})
	j.finish()
	wg.Wait()

	for k := 0; k < tailers; k++ {
		if counts[k] != events+1 {
			t.Fatalf("tailer %d saw %d events, want %d", k, counts[k], events+1)
		}
	}
}

// The store hands back a live job by id, scopes nothing itself (callers check the
// owner), and treats unknown or expired ids as absent.
func TestAskStore_GetPutExpiry(t *testing.T) {
	s := newAskStore()
	if s.get("nope") != nil {
		t.Fatal("unknown id should be nil")
	}
	j := newAskJob("k1", 3)
	s.put(j)
	if s.get("k1") != j {
		t.Fatal("put job should be retrievable")
	}
	// Force expiry: get() must treat it as gone.
	j.expiry = time.Now().Add(-time.Minute)
	if s.get("k1") != nil {
		t.Fatal("expired job should read as absent")
	}
}
