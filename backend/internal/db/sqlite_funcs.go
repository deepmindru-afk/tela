package db

import (
	"database/sql/driver"
	"regexp"

	sqlite "modernc.org/sqlite"
)

// M13.3a — Excalidraw FTS5 strip.
//
// Page bodies sent into the FTS5 index pass through `tela_strip_excalidraw`
// first (see migration 0010_fts_strip_excalidraw.sql, which rewrites the
// `pages_ai` / `pages_ad` / `pages_au` triggers to call this function). The
// strip removes ```excalidraw\n{json}\n``` fences so the JSON inside doesn't
// pollute the BM25-ranked search index.
//
// Implementation note on registration:
// modernc.org/sqlite's RegisterScalarFunction installs UDFs at the driver
// level — once init() runs, every connection opened via "sqlite" sees the
// function. Re-registration panics, so we use init() (guaranteed once per
// process) rather than calling from Open(). Production process, tests, and
// long-running test binaries all share the same registration.

// excalidrawFenceRE matches a complete ```excalidraw fenced block.
//
// Anatomy:
//   - three backticks + literal "excalidraw" — exact match for the GFM info
//     string. `\b` is unusable here because "-" is a non-word char so a
//     hyphenated identifier like "excalidraw-foo" would still match.
//   - optional `[ \t]+[^\n]*` allows additional space-separated info-string
//     metadata (rare; defensive). A direct hyphen or other continuation
//     letter is rejected because there's no space separator.
//   - \n forces the opening fence to end at a newline (rules out inline
//     `code` spans that happen to contain "```excalidraw").
//   - (?s).*? body content, lazy, multi-line.
//   - \n?``` closing fence with an optional preceding newline.
var excalidrawFenceRE = regexp.MustCompile("(?s)```excalidraw(?:[ \\t]+[^\\n]*)?\\n.*?\\n?```")

// StripExcalidrawFences removes every ```excalidraw fenced block from src.
// Exported for direct unit testing without spinning up a SQLite connection.
func StripExcalidrawFences(src string) string {
	return excalidrawFenceRE.ReplaceAllString(src, "")
}

func init() {
	sqlite.MustRegisterDeterministicScalarFunction(
		"tela_strip_excalidraw",
		1,
		func(_ *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
			if len(args) == 0 || args[0] == nil {
				return "", nil
			}
			switch v := args[0].(type) {
			case string:
				return StripExcalidrawFences(v), nil
			case []byte:
				return StripExcalidrawFences(string(v)), nil
			default:
				return "", nil
			}
		},
	)
}
