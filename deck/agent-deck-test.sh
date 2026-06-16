#!/usr/bin/env bash
# agent-deck-test.sh — fire a HEADLESS agent at tela with NO visual direction,
# just "make a deck", to exercise the full deck wiring end-to-end:
#   discover tela://deck-authoring-guide → create_page(deck) → lint_deck → preview_deck.
#
# Uses claude -p with stream-json IN and OUT (both JSON I/O params), verbose so
# every event is emitted, and bypassed permissions so it can call the tela MCP
# write/render tools unattended. The full event stream is saved (rerunnable).
#
#   ./agent-deck-test.sh            # default prompt, ambient claude MCP config (prod)
#   PROMPT='...' ./agent-deck-test.sh   # custom prompt
#   MCP_CONFIG=/tmp/local-tela-mcp.json ./agent-deck-test.sh   # target a LOCAL build:
#       point the agent at ONLY this MCP server (--strict-mcp-config), e.g. a dev
#       backend on :18080 with a PAT — so a test run never touches prod tela.
set -uo pipefail

OUT_DIR="${OUT_DIR:-/tmp/deck-agent}"
mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
STREAM="$OUT_DIR/run-$TS.jsonl"
PROMPTFILE="$OUT_DIR/run-$TS.prompt.txt"

# NO visual hints AND no "deck" — we want to see whether an uninstructed agent who
# uses everyday wording ("presentation"/"slides") still discovers the deck authoring
# guide + tools on its own and produces a styled deck. Avoiding the word "deck" is the
# point: it exercises the trigger broadening (deck → presentation/slides).
PROMPT="${PROMPT:-Put together a short slide presentation in tela about a topic of your choice that would suit a quick talk. Make it a real page in tela, then give me its link. Keep it to a handful of slides.}"

printf '%s\n' "$PROMPT" > "$PROMPTFILE"
echo "── PROMPT ─────────────────────────────────────────"
echo "$PROMPT"
echo "── stream → $STREAM ──"

# Optional: pin the agent to a single MCP server (a local dev backend) instead of
# the ambient claude config, so a run can target an unreleased build without
# touching prod tela. --strict-mcp-config ignores all other configured servers.
MCP_FLAGS=()
if [[ -n "${MCP_CONFIG:-}" ]]; then
  MCP_FLAGS=(--mcp-config "$MCP_CONFIG" --strict-mcp-config)
  echo "── MCP: local ($MCP_CONFIG) ──"
fi

# One stream-json user message on stdin; stream-json events on stdout (tee'd).
printf '%s' "{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":$(printf '%s' "$PROMPT" | jq -Rs .)}}" \
  | claude -p \
      --input-format stream-json \
      --output-format stream-json \
      --verbose \
      --dangerously-skip-permissions \
      "${MCP_FLAGS[@]}" \
  | tee "$STREAM" >/dev/null

echo
echo "── TOOL CALLS (in order) ──"
jq -rs '.[] | select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | .name' "$STREAM" 2>/dev/null
echo "── RESULT ──"
jq -rs '.[] | select(.type=="result") | .result' "$STREAM" 2>/dev/null
echo "── DECK LINK(S) ──"
grep -oE 'https?://[a-z0-9.:_-]+/spaces/[0-9]+/pages/[0-9]+[a-zA-Z0-9/_-]*' "$STREAM" | sort -u
echo "── COST/TURNS ──"
jq -rs '.[] | select(.type=="result") | "turns=\(.num_turns) cost=$\(.total_cost_usd) dur=\(.duration_ms)ms"' "$STREAM" 2>/dev/null
echo "(full stream saved: $STREAM)"
