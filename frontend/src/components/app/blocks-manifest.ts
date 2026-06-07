import manifest from './blocks-manifest.json'

// Typed view over blocks-manifest.json — the single source of truth for tela's
// authorable block palette. The slash menu (milkdown-slash.tsx) projects the
// `slash` entries into menu items (joining a `run` fn by `id`); the backend
// renders the `agent` entries into the MCP authoring guide from a generated
// copy (see scripts/blocks-manifest.mjs → backend/internal/api/blocks_gen.json).
// Edit the JSON, never this file's data.

export interface BlockSpec {
  /** Stable id; joins a slash entry to its `run` fn. */
  id: string
  /** Slash-menu primary label. */
  label: string
  /** Slash-menu secondary hint. */
  hint: string
  /** Grouping bucket for the agent authoring guide. */
  category: string
  /** Appears in the editor slash palette. */
  slash: boolean
  /** Appears in the agent-facing authoring guide. */
  agent: boolean
  /** Slash-menu search keywords. */
  keywords: string[]
  /** Exact round-trip markdown an author would type. */
  syntax: string
  /** One-line agent guidance (present when `agent`). */
  when?: string
  /** Optional caveat. */
  note?: string
}

export const BLOCKS: BlockSpec[] = manifest.blocks as unknown as BlockSpec[]

/** Block specs that belong in the editor slash palette, in manifest order. */
export const SLASH_BLOCKS: BlockSpec[] = BLOCKS.filter((b) => b.slash)
