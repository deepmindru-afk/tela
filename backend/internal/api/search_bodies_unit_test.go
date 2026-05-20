package api

import "testing"

// TestBuildFTSBodyMatch pins the per-term phrase-prefix contract independent
// of FTS5 engine behaviour. Edge cases here mirror the defensive paths in
// buildFTSBodyMatch (search_bodies.go) so future refactors can't silently
// change the wire format. End-to-end coverage of FTS5 evaluation lives in
// TestSearchBodies_FullFlow.
func TestBuildFTSBodyMatch(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"empty input", "", ""},
		{"whitespace only", "   \t  ", ""},
		{"happy path two terms", "foo bar", `"foo"* "bar"*`},
		{"mixed asterisk in term stripped", "foo*bar", `"foobar"*`},
		{"all asterisks collapse to empty", "***", ""},
		// `+` and `-` are not stripped — they end up inside the phrase quotes,
		// where FTS5 treats them as literal characters. Pin that so a future
		// rewrite can't accidentally promote them back to syntax position.
		{"plus chars stay literal inside quotes", "+++", `"+++"*`},
		// Smart/unicode quotes pass through unchanged. Only ASCII `"` is
		// doubled per FTS5 string-literal rules, which the next case covers.
		{"unicode smart quotes pass through", "“foo”", "\"“foo”\"*"},
		// ASCII `"` in input becomes `""` (FTS5 string-literal escape) and
		// then sits inside the outer phrase-quoting `"..."*`.
		{"ascii double-quote doubled", `"hello"`, `"""hello"""*`},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := buildFTSBodyMatch(tc.in)
			if got != tc.want {
				t.Fatalf("buildFTSBodyMatch(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}
