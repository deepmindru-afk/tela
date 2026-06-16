package llm

import (
	"context"
	"testing"
)

// fakeStreamCompleter implements both Completer and StreamCompleter with canned
// output, so we can assert the usage recorder fires with sane estimates.
type fakeStreamCompleter struct{ out string }

func (f fakeStreamCompleter) Complete(_ context.Context, _, _ string) (string, error) {
	return f.out, nil
}
func (f fakeStreamCompleter) Model() string { return "fake-model" }
func (f fakeStreamCompleter) CompleteStream(_ context.Context, _, _ string, onToken func(string) error) error {
	// Emit in two chunks to exercise the byte tally.
	if err := onToken(f.out[:len(f.out)/2]); err != nil {
		return err
	}
	return onToken(f.out[len(f.out)/2:])
}

type capture struct {
	model     string
	in, out   int
	callCount int
}

func TestService_RecordsCompleteUsage(t *testing.T) {
	var got capture
	s := NewServiceWithCompleter(fakeStreamCompleter{out: "hello there world"})
	s.SetUsageRecorder(func(model string, in, out int) {
		got = capture{model, in, out, got.callCount + 1}
	})

	if _, err := s.Complete(context.Background(), "system prompt", "user prompt"); err != nil {
		t.Fatalf("complete: %v", err)
	}
	if got.callCount != 1 {
		t.Fatalf("recorder called %d times, want 1", got.callCount)
	}
	if got.model != "fake-model" {
		t.Fatalf("model=%q", got.model)
	}
	// "system prompt"+"user prompt" = 24 chars → ~6 tokens in; "hello there world"
	// = 17 chars → ~5 out. Just assert both are positive.
	if got.in <= 0 || got.out <= 0 {
		t.Fatalf("token estimates not positive: in=%d out=%d", got.in, got.out)
	}
}

func TestService_RecordsStreamUsage(t *testing.T) {
	var got capture
	s := NewServiceWithCompleter(fakeStreamCompleter{out: "streamed answer text here"})
	s.SetUsageRecorder(func(model string, in, out int) {
		got = capture{model, in, out, got.callCount + 1}
	})

	var assembled string
	err := s.CompleteStream(context.Background(), "sys", "usr", func(tok string) error {
		assembled += tok
		return nil
	})
	if err != nil {
		t.Fatalf("stream: %v", err)
	}
	if assembled != "streamed answer text here" {
		t.Fatalf("stream reassembly mismatch: %q", assembled)
	}
	if got.callCount != 1 || got.out <= 0 {
		t.Fatalf("stream usage not recorded: %+v", got)
	}
	// Output estimate should track the streamed length (25 chars → ~7 tokens).
	if want := (len("streamed answer text here") + 3) / 4; got.out != want {
		t.Fatalf("stream out tokens=%d want %d", got.out, want)
	}
}

func TestEstimateTokens(t *testing.T) {
	if EstimateTokens("") != 0 {
		t.Fatalf("empty should be 0")
	}
	if EstimateTokens("abcd") != 1 {
		t.Fatalf("4 chars → 1 token")
	}
}
