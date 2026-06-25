package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"
)

// Detached ask jobs make a streamed answer survive a dropped connection.
//
// Why: an /ask answer takes 10–60s to generate (the LLM spends most of that on
// prompt-processing before the first token). Backgrounded iOS Safari suspends a
// tab's JS and tears down its in-flight SSE within ~a second — so a user who
// glances away mid-answer would lose the half-built result, and the failure
// surfaces as the misleading "the answer model didn't respond" card.
//
// The fix decouples generation from the connection: the LLM runs in a goroutine
// on a detached context, appending events to an ordered, replayable log; the
// HTTP stream merely *tails* that log. A dropped connection no longer cancels
// generation, and a reconnect (GET /api/rag/ask/stream?id=) replays what it
// missed and live-tails the rest. The live foreground stream is unchanged — it's
// just a tail from position 0, emitting the same sources/token/followups/done/
// error vocabulary the client already speaks.

const (
	// askJobTTL is how long a finished (or stalled) job stays resumable. Generous
	// enough to cover a long generation plus a user backgrounding the tab and
	// returning; an answer is a few KB, so holding a handful costs nothing.
	askJobTTL = 10 * time.Minute
	// askGenMaxDuration bounds a detached generation so a wedged upstream can't
	// leak its goroutine forever (the client connection no longer scopes it).
	askGenMaxDuration = 4 * time.Minute
)

// askEvent is one SSE frame in a job's log: the event name plus its JSON payload
// captured verbatim, so the tail loop re-emits byte-identical frames on replay.
type askEvent struct {
	name string
	data json.RawMessage
}

// askJob is a single in-flight (or finished) ask: an append-only event log with
// a broadcast so tailers wake on each new event, and a done flag set when
// generation terminates (a done or error event was emitted). Guarded by mu.
type askJob struct {
	id     string
	userID int64

	mu     sync.Mutex
	cond   *sync.Cond
	log    []askEvent
	done   bool
	expiry time.Time
}

func newAskJob(id string, userID int64) *askJob {
	j := &askJob{id: id, userID: userID}
	j.cond = sync.NewCond(&j.mu)
	return j
}

// emit appends one event and wakes every tailer. A marshal failure (never
// happens for our payloads) drops the event rather than corrupting the log.
func (j *askJob) emit(name string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	j.mu.Lock()
	j.log = append(j.log, askEvent{name: name, data: data})
	j.cond.Broadcast()
	j.mu.Unlock()
}

// finish marks generation complete and wakes tailers so they drain and return.
func (j *askJob) finish() {
	j.mu.Lock()
	j.done = true
	j.cond.Broadcast()
	j.mu.Unlock()
}

// tail replays log[from:] through fn, then blocks for new events until the job
// finishes or ctx is canceled (the tailer's HTTP connection dropped). fn is
// called WITHOUT the lock held; an fn error (client write failed) stops only
// this tailer — generation continues for any other/future connection. Returns
// the index one past the last delivered event.
func (j *askJob) tail(ctx context.Context, from int, fn func(name string, data json.RawMessage) error) (int, error) {
	// sync.Cond can't select on ctx, so a watcher broadcasts on cancel to wake the
	// Wait below; the loop then re-checks ctx and returns.
	stop := context.AfterFunc(ctx, func() {
		j.mu.Lock()
		j.cond.Broadcast()
		j.mu.Unlock()
	})
	defer stop()

	i := from
	for {
		j.mu.Lock()
		for i >= len(j.log) && !j.done && ctx.Err() == nil {
			j.cond.Wait()
		}
		pending := append([]askEvent(nil), j.log[i:]...)
		done := j.done
		j.mu.Unlock()

		if ctx.Err() != nil {
			return i, ctx.Err()
		}
		for _, ev := range pending {
			if err := fn(ev.name, ev.data); err != nil {
				return i, err
			}
			i++
		}
		if done {
			return i, nil
		}
	}
}

// askStore holds in-flight/recent jobs by id, evicting expired ones. One per
// Server. Memory is bounded: jobs are small and short-lived, and put() reaps the
// expired before inserting so the map can't grow without bound.
type askStore struct {
	mu   sync.Mutex
	jobs map[string]*askJob
}

func newAskStore() *askStore { return &askStore{jobs: map[string]*askJob{}} }

// put registers a job with a fresh TTL, first dropping any that have expired.
func (s *askStore) put(j *askJob) {
	now := time.Now()
	j.expiry = now.Add(askJobTTL)
	s.mu.Lock()
	for id, old := range s.jobs {
		if now.After(old.expiry) {
			delete(s.jobs, id)
		}
	}
	s.jobs[j.id] = j
	s.mu.Unlock()
}

// get returns the live (non-expired) job for id, or nil.
func (s *askStore) get(id string) *askJob {
	s.mu.Lock()
	defer s.mu.Unlock()
	j := s.jobs[id]
	if j == nil || time.Now().After(j.expiry) {
		return nil
	}
	return j
}

// newAskID returns a random opaque job id (caller scopes reads to the owner).
func newAskID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand failing is fatal-grade; fall back to a time-seeded id so the
		// ask still works rather than panicking the request.
		return hex.EncodeToString([]byte(time.Now().UTC().Format("20060102150405.000000000")))
	}
	return hex.EncodeToString(b[:])
}
