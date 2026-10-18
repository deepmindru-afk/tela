package api

import (
	"strings"
	"testing"
)

// The sheet write gate rejects structurally-broken agent-authored Defter bodies
// (via the in-process defterparse port) with actionable, located feedback, and
// passes valid ones. Humans edit through the grid and are never gated.
func TestSheetWriteGate(t *testing.T) {
	var s Server // gate uses no server state

	valid := "| Item | Total |\n| --- | --- |\n| Rent | =A2 |\n"
	if ae := s.sheetWriteGate(valid); ae != nil {
		t.Fatalf("valid sheet rejected: %s", ae.Message)
	}

	// 0.1.5 checkbox/date directives must pass the gate (they previously tripped
	// "bad target syntax" and blocked agent-authored checkbox sheets).
	cbDate := "| Task | Due | Done |\n| --- | --- | --- |\n| A | 2026-07-10 | TRUE |\n\n" +
		"```defter-style\ncheckbox C2:C2\ndate B2:B2\n```\n"
	if ae := s.sheetWriteGate(cbDate); ae != nil {
		t.Fatalf("checkbox/date sheet rejected: %s", ae.Message)
	}

	// A malformed defter-style rule (unknown attribute) is caught.
	badAttr := "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```defter-style\nA1:B1  notanattr=5\n```\n"
	ae := s.sheetWriteGate(badAttr)
	if ae == nil {
		t.Fatalf("malformed defter-style rule not rejected")
	}
	if ae.Code != "sheet_invalid" {
		t.Fatalf("wrong error code: %s", ae.Code)
	}
	if !strings.Contains(ae.Message, "notanattr") {
		t.Fatalf("message should surface the offending attribute, got: %s", ae.Message)
	}

	// Duplicate sheet names are caught too.
	dup := "## Sheet: X\n| A |\n| --- |\n| 1 |\n\n## Sheet: X\n| A |\n| --- |\n| 1 |\n"
	if s.sheetWriteGate(dup) == nil {
		t.Fatalf("duplicate sheet name not rejected")
	}
}
