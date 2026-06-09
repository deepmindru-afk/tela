import { findAndReplace } from 'mdast-util-find-and-replace'
import { pageSlug } from '../../slug'

// Pure, Milkdown-free `[[Name]]` / `[[Name|alias]]` parsing. SINGLE SOURCE
// shared by the Milkdown editor (milkdown-wikilink-bracket.ts wraps this in
// `$remark` + builds the atom schema) and the view renderer's parser
// (lib/markdown/remark-stack.ts). See docs/view-edit-split.md.

// Non-greedy, no nested brackets — mirrors the backend wikiBracketRE.
const BRACKET_RE = /\[\[([^[\]]+?)\]\]/g

interface WikilinkParts {
  target: string
  alias: string | null
}

// Split the inner text into target + optional display alias. The alias (after
// `|`) is display-only; a `#heading` suffix stays inside target.
export function splitWikilink(inner: string): WikilinkParts {
  const bar = inner.indexOf('|')
  if (bar >= 0) {
    const alias = inner.slice(bar + 1).trim()
    return { target: inner.slice(0, bar).trim(), alias: alias.length > 0 ? alias : null }
  }
  return { target: inner.trim(), alias: null }
}

// Slug used for resolution: drop any `#heading`, then slugify the title exactly
// as the backend does (parity with pageSlug → resolveWikiTitleSlugs).
export function wikilinkSlug(target: string): string {
  const hash = target.indexOf('#')
  return pageSlug(hash >= 0 ? target.slice(0, hash) : target)
}

interface MdastWikilink {
  type: 'wikilink'
  target: string
  alias: string | null
}

// Regular function so unified binds `this` to the processor, letting us register
// the to-markdown handler for our custom `wikilink` node. Typed loosely.
export function wikilinkRemark(this: { data: () => Record<string, unknown> }) {
  const data = this.data()
  const toMarkdownExtensions = (data.toMarkdownExtensions ||
    (data.toMarkdownExtensions = [])) as Array<{ handlers: Record<string, unknown> }>
  toMarkdownExtensions.push({
    handlers: {
      wikilink: (node: MdastWikilink) =>
        node.alias ? `[[${node.target}|${node.alias}]]` : `[[${node.target}]]`,
    },
  })
  return (tree: unknown) => {
    findAndReplace(tree as never, [
      [
        BRACKET_RE,
        (_full: string, inner: string) => {
          const { target, alias } = splitWikilink(inner)
          // `[[ ]]` / `[[|x]]` — nothing to link; leave the literal text.
          if (target === '') return false as never
          return { type: 'wikilink', target, alias } as never
        },
      ],
    ])
  }
}
