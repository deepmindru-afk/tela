// Package agreement computes the corroboration/contradiction signal for the
// epistemic trust strip (Slice 2) — the LLM sibling of internal/summarize. For
// each page it pulls the nearest pages in the SAME space and asks the model
// whether each corroborates, contradicts, or is unrelated to the target, then
// records the tallies + dispute details in page_agreement (migration 0034).
//
// Like summarize: the page body is never touched (computed, not authored); it is
// keyed by sha256(body) so it skips work when nothing changed; it runs in a
// debounced background worker (worker.go), never on the read path; and it ships
// dark — disabled-but-non-nil — when the LLM or embedder is unconfigured.
//
// Same-space scoping is load-bearing: a reader who can see the page can see every
// page named in its disputes, so the signal never leaks a page across access.
package agreement

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/zcag/tela/backend/internal/llm"
	"github.com/zcag/tela/backend/internal/rag"
)

const (
	neighborLimit  = 5   // how many same-space neighbours to weigh
	neighborMinSim = 0.6 // …that are at least this cosine-similar
	maxTextChars   = 700 // per-page text budget fed to the model
)

// Service bundles the DB, the chat client, and the rag service (for same-space
// neighbours), plus the debounced work queue (worker.go). Disabled when either
// the LLM or the embedder is off ⇒ the whole feature no-ops.
type Service struct {
	db  *sql.DB
	llm *llm.Service
	rag *rag.Service

	queueMu  sync.Mutex
	pending  map[int64]time.Time
	attempts map[int64]int
}

// NewService builds the service. Never fails; constructed disabled when the LLM
// or embedder is off so api.Server can hold a non-nil handle.
func NewService(db *sql.DB, l *llm.Service, r *rag.Service) *Service {
	return &Service{db: db, llm: l, rag: r}
}

// Enabled reports whether both halves it needs are configured: a chat model (to
// judge) and the embedder (to find neighbours).
func (s *Service) Enabled() bool {
	return s != nil && s.llm.Enabled() && s.rag != nil && s.rag.Enabled()
}

// Model returns the active chat model name ("" when disabled).
func (s *Service) Model() string { return s.llm.Model() }

func srcHash(body string) string {
	h := sha256.Sum256([]byte(body))
	return hex.EncodeToString(h[:])
}

func clamp(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

// Dispute is one contradicting same-space page, recorded for the trust strip.
type Dispute struct {
	PageID int64  `json:"page_id"`
	Title  string `json:"title"`
	Reason string `json:"reason"`
}

const agreementSystem = "You compare a TARGET wiki page against other pages from the same wiki and decide, for each, whether it CORROBORATES the target (states or supports the same facts), CONTRADICTS it (asserts something that genuinely conflicts), or is UNRELATED (different topic, or related but neither agrees nor disagrees). Only say contradict on a real factual conflict — never on a mere difference of scope, detail, or recency. Output ONE line per page, exactly in the form: INDEX|VERDICT|REASON — where VERDICT is one of corroborate, contradict, unrelated, and REASON is a brief phrase (leave empty for unrelated). No preamble, no extra lines."

// AgreePage computes and stores the agreement signal for one page. Idempotent via
// the body hash (force bypasses). Skips the LLM call entirely when the page has
// no close same-space neighbour (records an empty result so the sweep won't keep
// retrying it). On the LLM/neighbour error path it records a failure row so the
// page stays eligible for a backed-off retry.
func (s *Service) AgreePage(ctx context.Context, pageID int64, force bool) error {
	if !s.Enabled() {
		return fmt.Errorf("agreement: not configured")
	}

	var title, body string
	err := s.db.QueryRowContext(ctx,
		`SELECT title, body FROM pages WHERE id = $1 AND deleted_at IS NULL`, pageID).Scan(&title, &body)
	if errors.Is(err, sql.ErrNoRows) {
		return nil // deleted while queued
	}
	if err != nil {
		return fmt.Errorf("agreement: load page %d: %w", pageID, err)
	}
	if strings.TrimSpace(body) == "" {
		return nil
	}

	hash := srcHash(body)
	if !force {
		var have string
		e := s.db.QueryRowContext(ctx,
			`SELECT src_hash FROM page_agreement WHERE page_id = $1 AND last_error = ''`, pageID).Scan(&have)
		if e != nil && !errors.Is(e, sql.ErrNoRows) {
			return fmt.Errorf("agreement: check hash: %w", e)
		}
		if e == nil && have == hash {
			return nil // fresh
		}
	}

	neighbors, err := s.rag.PageNeighborsInSpace(ctx, pageID, neighborLimit, neighborMinSim)
	if err != nil {
		s.recordFailure(ctx, pageID, err)
		return fmt.Errorf("agreement: neighbours %d: %w", pageID, err)
	}

	var corroborate, dispute int
	disputes := []Dispute{}
	if len(neighbors) > 0 {
		var b strings.Builder
		fmt.Fprintf(&b, "TARGET PAGE:\nTitle: %s\n%s\n\nOTHER PAGES:\n", title, clamp(body, maxTextChars))
		for i, n := range neighbors {
			fmt.Fprintf(&b, "[%d] %s\n%s\n\n", i+1, n.Title, clamp(n.Body, maxTextChars))
		}
		b.WriteString("Classify each numbered page.")
		out, err := s.llm.Complete(ctx, agreementSystem, b.String())
		if err != nil {
			s.recordFailure(ctx, pageID, err)
			return fmt.Errorf("agreement page %d: %w", pageID, err)
		}
		corroborate, dispute, disputes = parseVerdicts(out, neighbors)
	}

	payload, _ := json.Marshal(disputes)
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO page_agreement (page_id, src_hash, model, corroborate, dispute, disputes, computed_at, last_error, attempts)
		VALUES ($1, $2, $3, $4, $5, $6, tela_now(), '', 0)
		ON CONFLICT (page_id) DO UPDATE
		   SET src_hash = EXCLUDED.src_hash, model = EXCLUDED.model,
		       corroborate = EXCLUDED.corroborate, dispute = EXCLUDED.dispute,
		       disputes = EXCLUDED.disputes, computed_at = tela_now(),
		       last_error = '', attempts = 0`,
		pageID, hash, s.llm.Model(), corroborate, dispute, string(payload)); err != nil {
		return fmt.Errorf("agreement: upsert %d: %w", pageID, err)
	}
	return nil
}

// parseVerdicts reads the model's "INDEX|VERDICT|REASON" lines back into tallies.
// Lenient: it tolerates a bracketed index ([2]) and stray lines, and ignores any
// index outside the neighbour range.
func parseVerdicts(out string, neighbors []rag.Neighbor) (int, int, []Dispute) {
	corr, disp := 0, 0
	disputes := []Dispute{}
	for _, ln := range strings.Split(out, "\n") {
		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}
		parts := strings.SplitN(ln, "|", 3)
		if len(parts) < 2 {
			continue
		}
		idxTok := strings.Trim(strings.TrimSpace(parts[0]), "[]().")
		idx, err := strconv.Atoi(idxTok)
		if err != nil || idx < 1 || idx > len(neighbors) {
			continue
		}
		verdict := strings.ToLower(strings.TrimSpace(parts[1]))
		reason := ""
		if len(parts) == 3 {
			reason = strings.TrimSpace(parts[2])
		}
		switch {
		case strings.HasPrefix(verdict, "corrob"):
			corr++
		case strings.HasPrefix(verdict, "contra"):
			disp++
			n := neighbors[idx-1]
			disputes = append(disputes, Dispute{PageID: n.PageID, Title: n.Title, Reason: reason})
		}
	}
	return corr, disp, disputes
}

// recordFailure upserts a failure row so the page stays eligible for a backed-off
// retry (the worker's fresh-check skips only rows with last_error = ”).
func (s *Service) recordFailure(ctx context.Context, pageID int64, cause error) {
	msg := cause.Error()
	if len(msg) > 500 {
		msg = msg[:500]
	}
	_, _ = s.db.ExecContext(ctx, `
		INSERT INTO page_agreement (page_id, src_hash, model, last_error, attempts, computed_at)
		VALUES ($1, '', $2, $3, 1, tela_now())
		ON CONFLICT (page_id) DO UPDATE
		   SET last_error = $3, attempts = page_agreement.attempts + 1`,
		pageID, s.llm.Model(), msg)
}
