package agreement

import "testing"

import "github.com/zcag/tela/backend/internal/rag"

func TestParseVerdicts(t *testing.T) {
	neighbors := []rag.Neighbor{
		{PageID: 10, Title: "Deploy runbook"},
		{PageID: 11, Title: "Old deploy notes"},
		{PageID: 12, Title: "Unrelated thing"},
		{PageID: 13, Title: "Backup policy"},
	}
	// Mixed, slightly messy output: a bracketed index, varied casing, a stray
	// preamble line, and a verdict the parser must ignore (unrelated).
	out := "Here are my classifications:\n" +
		"1|corroborate|both say deploy via make deploy\n" +
		"[2] | Contradict | says the old port 8080, target says 8780\n" +
		"3|unrelated|\n" +
		"4|CORROBORATE|backup cadence matches\n" +
		"7|contradict|out of range — must be ignored"

	corr, disp, disputes := parseVerdicts(out, neighbors)
	if corr != 2 {
		t.Fatalf("corroborate = %d, want 2", corr)
	}
	if disp != 1 {
		t.Fatalf("dispute = %d, want 1", disp)
	}
	if len(disputes) != 1 || disputes[0].PageID != 11 {
		t.Fatalf("disputes = %+v, want one for page 11", disputes)
	}
	if disputes[0].Reason == "" {
		t.Fatalf("dispute reason should be captured, got empty")
	}
}

func TestParseVerdictsEmpty(t *testing.T) {
	corr, disp, disputes := parseVerdicts("", []rag.Neighbor{{PageID: 1}})
	if corr != 0 || disp != 0 || len(disputes) != 0 {
		t.Fatalf("empty output should yield zero verdicts, got %d/%d/%d", corr, disp, len(disputes))
	}
}
