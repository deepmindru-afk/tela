import { $nodeSchema } from '@milkdown/kit/utils'
import { editorViewCtx } from '@milkdown/kit/core'
import type { Ctx } from '@milkdown/ctx'

// Deck: a `:::deck` container directive whose `---` (thematic break) separators
// split the body into slides. tela renders the slides as framed, numbered
// sections (a doc projection of a presentation); full-screen Present mode is a
// later, read-side layer over the same DOM. In plain markdown it degrades to
// `---`-separated content, all readable in order. Round-trips via
// mdast-util-directive — the canonical form IS the directive + thematic breaks,
// so nothing proprietary is stored, and the body is Marp-compatible (strip the
// wrapper → a valid Marp deck).
//
// Schema: `deck` (content `slide+`) > `slide` (content `block+`). The split
// (`---` → slides) happens in the parse runner; the inverse (slides → directive
// + `---`) in the serialize runner. No nodeView: slides are all visible and
// stacked, so plain schema toDOM + CSS (counter for the slide number) is enough.

interface MdastNode {
  type: string
  depth?: number
  name?: string
  value?: string
  children?: MdastNode[]
}

export const slideSchema = $nodeSchema('slide', () => ({
  group: 'slide',
  content: 'block+',
  defining: true,
  parseDOM: [{ tag: 'section[data-slide]' }],
  toDOM: () => ['section', { 'data-slide': '', class: 'tela-slide' }, 0],
  // Produced/consumed by the parent `deck` runner — no standalone markdown.
  parseMarkdown: { match: () => false, runner: () => {} },
  toMarkdown: {
    match: (node) => node.type.name === 'slide',
    runner: (state, node) => {
      state.next(node.content)
    },
  },
}))

export const deckSchema = $nodeSchema('deck', () => ({
  group: 'block',
  content: 'slide+',
  defining: true,
  parseDOM: [{ tag: 'div[data-deck]' }],
  toDOM: () => ['div', { 'data-deck': '', class: 'tela-deck' }, 0],
  parseMarkdown: {
    match: (node) =>
      node.type === 'containerDirective' && (node as MdastNode).name === 'deck',
    runner: (state, node, type) => {
      const slideType = type.schema.nodes.slide
      const paraType = type.schema.nodes.paragraph
      const children = (node as MdastNode).children ?? []
      state.openNode(type)
      let slideHasBlock = false
      // A slide needs >=1 block; an empty one (leading/trailing/consecutive
      // `---`) gets a single empty paragraph so `slide+`/`block+` hold.
      const fillEmpty = () => {
        if (!slideHasBlock && paraType) {
          state.openNode(paraType)
          state.closeNode()
        }
      }
      state.openNode(slideType) // first slide (content before the first `---`)
      for (const child of children) {
        if (child.type === 'thematicBreak') {
          fillEmpty()
          state.closeNode()
          state.openNode(slideType)
          slideHasBlock = false
        } else {
          state.next(child as never)
          slideHasBlock = true
        }
      }
      fillEmpty()
      state.closeNode() // last slide
      state.closeNode() // deck
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'deck',
    runner: (state, node) => {
      state.openNode('containerDirective', undefined, { name: 'deck' })
      node.forEach((slide, _offset, index) => {
        if (index > 0) state.addNode('thematicBreak')
        state.next(slide.content)
      })
      state.closeNode()
    },
  },
}))

// Slash inserter: a two-slide scaffold.
export function insertDeck(ctx: Ctx) {
  const view = ctx.get(editorViewCtx)
  const { schema } = view.state
  const deckType = schema.nodes.deck
  const slideType = schema.nodes.slide
  const paraType = schema.nodes.paragraph
  if (!deckType || !slideType || !paraType) return
  const mkSlide = () => slideType.create(null, paraType.create())
  const node = deckType.create(null, [mkSlide(), mkSlide()])
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
  view.focus()
}
