#!/usr/bin/env bash
# agent-deck-test.sh — fire a HEADLESS agent at tela with NO visual direction,
# just "make a deck", to exercise the full deck wiring end-to-end:
#   discover tela://deck-authoring-guide → create_page(deck) → lint_deck → preview_deck.
#
# Uses claude -p with stream-json IN and OUT (both JSON I/O params), verbose so
# every event is emitted, and bypassed permissions so it can call the tela MCP
# write/render tools unattended. The full event stream is saved (rerunnable).
#
#   ./agent-deck-test.sh            # default prompt
#   PROMPT='...' ./agent-deck-test.sh   # custom prompt
set -uo pipefail

OUT_DIR="${OUT_DIR:-/tmp/deck-agent}"
mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
STREAM="$OUT_DIR/run-$TS.jsonl"
PROMPTFILE="$OUT_DIR/run-$TS.prompt.txt"

# NO visual hints — we want to see whether an uninstructed agent discovers the
# deck authoring guide + tools on its own and produces a styled deck.
PROMPT="${PROMPT:-Create a slide deck in tela about a topic of your choice that would suit a short talk. Make it a real deck page in tela, then give me its link. Keep it to a handful of slides.}"

printf '%s\n' "$PROMPT" > "$PROMPTFILE"
echo "── PROMPT ─────────────────────────────────────────"
echo "$PROMPT"
echo "── stream → $STREAM ──"

# One stream-json user message on stdin; stream-json events on stdout (tee'd).
printf '%s' "{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":$(printf '%s' "$PROMPT" | jq -Rs .)}}" \
  | claude -p \
      --input-format stream-json \
      --output-format stream-json \
      --verbose \
      --dangerously-skip-permissions \
  | tee "$STREAM" >/dev/null

echo
echo "── TOOL CALLS (in order) ──"
jq -rs '.[] | select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | .name' "$STREAM" 2>/dev/null
echo "── RESULT ──"
jq -rs '.[] | select(.type=="result") | .result' "$STREAM" 2>/dev/null
echo "── DECK LINK(S) ──"
grep -oE 'https://tela\.cagdas\.io/spaces/[0-9]+/pages/[0-9]+[a-zA-Z0-9/_-]*' "$STREAM" | sort -u
echo "── COST/TURNS ──"
jq -rs '.[] | select(.type=="result") | "turns=\(.num_turns) cost=$\(.total_cost_usd) dur=\(.duration_ms)ms"' "$STREAM" 2>/dev/null
echo "(full stream saved: $STREAM)"
