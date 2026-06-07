package mdimport

import (
	"fmt"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// frontmatterRE matches a leading YAML-frontmatter block: a `---` line at the
// very start of the document, content, then a closing `---` line. We accept
// both LF and CRLF line endings so files written on Windows still round-trip.
// Group 1 captures the inner YAML.
var frontmatterRE = regexp.MustCompile(`(?s)\A---\r?\n(.*?)\r?\n---\r?\n?`)

// h1RE finds the first ATX H1 (`# Heading`) anywhere in the body.
var h1RE = regexp.MustCompile(`(?m)^#\s+(.+?)\s*$`)

// reservedKeys are frontmatter keys tela owns elsewhere (a tela column or a pure
// derivation) and therefore never stores in the props bag. They are silently
// dropped on the way in and re-synthesized from the source of truth on emit. See
// docs/page-properties.md "Reserved-key policy". Matched case-insensitively.
var reservedKeys = map[string]bool{
	"id": true, "title": true, "slug": true, "link": true, "url": true,
	"created": true, "date": true, "updated": true, "modified": true,
	"position": true, "parent": true, "space": true,
}

// StripFrontmatter detects a leading YAML frontmatter block and returns the body
// with the block removed, the frontmatter title (empty if absent), and the
// remaining free-form properties as a JSON-safe map (reserved keys dropped, nil
// when there is no frontmatter).
//
// A leading `---…---` block is only treated as frontmatter when its inner text
// parses to a YAML mapping. A block that parses to a scalar or sequence — e.g. a
// markdown document that opens with a `---` thematic break — is left untouched
// (the original content is returned), so malformed/non-mapping blocks can never
// crash the import or be mis-eaten.
func StripFrontmatter(content string) (body, title string, props map[string]any) {
	loc := frontmatterRE.FindStringSubmatchIndex(content)
	if loc == nil {
		return content, "", nil
	}
	inner := content[loc[2]:loc[3]]

	var m map[string]any
	if err := yaml.Unmarshal([]byte(inner), &m); err != nil {
		// Not a YAML mapping (scalar/sequence/garbage) — not frontmatter.
		return content, "", nil
	}
	body = content[loc[1]:]
	if m == nil {
		m = map[string]any{}
	}
	m = jsonSafeMap(m)

	// Title is extracted case-insensitively, consistent with reserved-key
	// filtering — a key we reserve (and drop) should also be able to seed it.
	for k, v := range m {
		if strings.ToLower(k) == "title" && v != nil {
			title = strings.TrimSpace(fmt.Sprintf("%v", v))
			break
		}
	}
	return body, title, FilterReserved(m)
}

// FilterReserved removes reserved keys (the ones tela owns via a column or
// derivation) from a props bag, mutating and returning it. Apply at every props
// ingress — frontmatter parse AND the explicit props field — so the silent-drop
// rule holds regardless of path. Matched case-insensitively.
func FilterReserved(props map[string]any) map[string]any {
	for k := range props {
		if reservedKeys[strings.ToLower(k)] {
			delete(props, k)
		}
	}
	return props
}

// jsonSafeMap recursively coerces a parsed-YAML map so it is safe to json.Marshal
// into a JSONB column: any nested map with non-string keys (yaml can produce
// these) is rebuilt with stringified keys. Scalars and slices pass through;
// yaml timestamps stay time.Time and serialize to RFC3339 (an accepted,
// documented normalization — value-faithful, not byte-faithful).
func jsonSafeMap(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = jsonSafe(v)
	}
	return out
}

func jsonSafe(v any) any {
	switch t := v.(type) {
	case map[string]any:
		return jsonSafeMap(t)
	case map[any]any:
		out := make(map[string]any, len(t))
		for k, vv := range t {
			out[fmt.Sprintf("%v", k)] = jsonSafe(vv)
		}
		return out
	case []any:
		for i := range t {
			t[i] = jsonSafe(t[i])
		}
		return t
	default:
		return v
	}
}

// FirstH1Title returns the text of the first ATX H1 heading in body, or "" if
// there is none. Caller is responsible for first stripping frontmatter — the
// regex matches anywhere in the input, so passing raw frontmatter would still
// look inside it.
func FirstH1Title(body string) string {
	m := h1RE.FindStringSubmatch(body)
	if m == nil {
		return ""
	}
	return strings.TrimSpace(m[1])
}
