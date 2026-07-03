package api

import (
	"fmt"
	"net/http"
	"strings"

	defterparse "github.com/zcag/defter/go"
)

// sheetWriteGate structurally validates an agent-authored sheet body using the
// in-process defterparse Go port (defter's Tier-1 pure-text layer). Malformed
// tables / defter-style rules are rejected with actionable, per-issue feedback
// so an agent fixes them instead of silently saving a broken sheet. It's the
// sheet analog of deckWriteGate — but in-process (no sidecar), so there's
// nothing to fail open on. Humans edit through the live grid (which only ever
// emits valid Defter), so the gate is applied to agent writes only.
func (s *Server) sheetWriteGate(body string) *apiErr {
	issues := defterparse.LintText(body)
	if len(issues) == 0 {
		return nil
	}
	const maxShown = 10
	var b strings.Builder
	fmt.Fprintf(&b, "sheet has %d structural issue(s):", len(issues))
	for i, is := range issues {
		if i >= maxShown {
			fmt.Fprintf(&b, "\n… and %d more", len(issues)-maxShown)
			break
		}
		loc := is.Cell
		if loc == "" && is.Line > 0 {
			loc = fmt.Sprintf("line %d", is.Line)
		}
		if is.Sheet != "" {
			loc = strings.TrimSpace(is.Sheet + " " + loc)
		}
		if loc != "" {
			fmt.Fprintf(&b, "\n- [%s] %s", loc, is.Message)
		} else {
			fmt.Fprintf(&b, "\n- %s", is.Message)
		}
	}
	return &apiErr{http.StatusUnprocessableEntity, "sheet_invalid", b.String()}
}
