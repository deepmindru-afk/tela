import { $ctx, $nodeSchema, $remark } from '@milkdown/kit/utils'

// M13.3a — Excalidraw view-mode renderer.
//
// Recognizes ```excalidraw\n{json}\n``` markdown fences and materializes them
// as ProseMirror atom nodes that render `<img src=/api/diagrams/{page_id}/{
// scene_hash}.png>` against the M13.2 backend (#111). Read-only view path:
// ZERO Excalidraw runtime, ZERO new npm deps. The Edit Sheet ships in M13.3b
// (#113) as a separate lazy chunk.
//
// Three pieces wired together:
// 1. `excalidrawRemarkPlugin` — mdast transformer. Matches `code` nodes whose
//    info string is exactly `excalidraw`; parses the body as JSON; extracts
//    `scene_hash` (validated `^[a-f0-9]{8,64}$` to match the backend) and
//    optional `alt_text`; rewrites the node `type` to `excalidraw` carrying
//    the parsed attrs and the raw JSON for round-trip. On parse / hash
//    validation failure the node is left untouched (falls through to a plain
//    code block — current behaviour for an unrecognized info string).
// 2. `excalidrawSchema` — `$nodeSchema('excalidraw', ...)`. ProseMirror atom
//    node (researcher #98 verdict): non-editable inline at the doc level so
//    Yjs sees the whole diagram as one node — every drawing tick inside the
//    Edit Sheet stays out of the live-collab CRDT update stream. `toDOM`
//    renders `<div class="tela-excalidraw"><img src="/api/diagrams/${pageId}/
//    ${sceneHash}.png"></div>`; the browser handles 404 by surfacing the alt
//    text natively (no extra JS). `toMarkdown` re-emits the fence with the
//    original sceneJSON preserved.
// 3. `pageIdCtx` — `$ctx<number>` carrying the active page id so `toDOM` can
//    construct the PNG URL. Wired identically to `wikilinkModeCtx` and
//    `commentThreadsCtx` (passed via React prop → useEffect → ctx.set).

const SCENE_HASH_RE = /^[a-f0-9]{8,64}$/

export const pageIdCtx = $ctx<number, 'excalidrawPageId'>(0, 'excalidrawPageId')

interface MdastNode {
  type: string
  lang?: string | null
  value?: string
  children?: MdastNode[]
  sceneHash?: string
  altText?: string
  sceneJSON?: string
  [k: string]: unknown
}

interface ExcalidrawSceneJSON {
  scene_hash?: unknown
  alt_text?: unknown
  [k: string]: unknown
}

// Walk the mdast tree and rewrite qualifying ```excalidraw fences into
// `excalidraw` mdast nodes in place. Recurses into block children so
// excalidraw fences inside blockquotes / details work too.
function transformExcalidrawInMdast(node: MdastNode): void {
  if (
    node.type === 'code' &&
    typeof node.lang === 'string' &&
    node.lang === 'excalidraw' &&
    typeof node.value === 'string'
  ) {
    const raw = node.value
    let parsed: ExcalidrawSceneJSON | null
    try {
      parsed = JSON.parse(raw) as ExcalidrawSceneJSON
    } catch {
      parsed = null
    }
    if (parsed && typeof parsed === 'object') {
      const sceneHash = typeof parsed.scene_hash === 'string' ? parsed.scene_hash : ''
      const altText = typeof parsed.alt_text === 'string' ? parsed.alt_text : ''
      if (SCENE_HASH_RE.test(sceneHash)) {
        node.type = 'excalidraw'
        node.sceneHash = sceneHash
        node.altText = altText
        node.sceneJSON = raw
        delete node.lang
        delete node.value
        return
      }
    }
    // Parse failure or invalid scene_hash: leave as plain code block.
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      transformExcalidrawInMdast(child)
    }
  }
}

export const excalidrawRemarkPlugin = $remark(
  'telaExcalidraw',
  () => () => (tree) => {
    transformExcalidrawInMdast(tree as unknown as MdastNode)
  },
)

// Mirror PM's NodeSpec.toDOM `Node` arg loosely to dodge the cross-package
// Node-type mismatch between `@milkdown/prose/model` and `prosemirror-model`
// (same runtime class, distinct TS types under bundler resolution).
interface ExcalidrawSchemaNode {
  attrs: { sceneHash: string; altText: string; sceneJSON: string }
}

// Minimal valid scene JSON used as the `sceneJSON` for an atom inserted via
// slash menu before the Edit Sheet has been used (M13.3b). Keeps round-trip
// consistent: an "empty" diagram still parses + re-serializes cleanly.
const EMPTY_SCENE_JSON = '{"elements":[],"appState":{},"scene_hash":""}'

export const excalidrawSchema = $nodeSchema('excalidraw', (ctx) => ({
  group: 'block',
  atom: true,
  defining: true,
  draggable: true,
  selectable: true,
  isolating: true,
  marks: '',
  attrs: {
    sceneHash: { default: '' },
    altText: { default: '' },
    sceneJSON: { default: '' },
  },
  parseDOM: [
    {
      tag: 'div.tela-excalidraw[data-scene-hash]',
      getAttrs: (dom) => {
        const el = dom as HTMLElement
        return {
          sceneHash: el.getAttribute('data-scene-hash') ?? '',
          altText: el.getAttribute('data-alt-text') ?? '',
          sceneJSON: el.getAttribute('data-scene-json') ?? '',
        }
      },
    },
  ],
  toDOM: (node) => {
    const { sceneHash, altText, sceneJSON } = (node as unknown as ExcalidrawSchemaNode).attrs
    const pageId = ctx.get(pageIdCtx.key)
    if (!sceneHash) {
      // Newly-inserted atom (slash menu) with no PNG yet. Placeholder chrome
      // hints the user to open the Edit Sheet (M13.3b will wire that path).
      return [
        'div',
        {
          class: 'tela-excalidraw tela-excalidraw--empty',
          'data-scene-hash': '',
          'data-alt-text': altText,
          'data-scene-json': sceneJSON,
        },
        '[Empty diagram — Edit to draw]',
      ]
    }
    return [
      'div',
      {
        class: 'tela-excalidraw',
        'data-scene-hash': sceneHash,
        'data-alt-text': altText,
        'data-scene-json': sceneJSON,
      },
      [
        'img',
        {
          src: `/api/diagrams/${pageId}/${sceneHash}.png`,
          alt: altText || 'Excalidraw diagram',
          loading: 'lazy',
        },
      ],
    ]
  },
  parseMarkdown: {
    match: ({ type }) => type === 'excalidraw',
    runner: (state, node, type) => {
      const n = node as MdastNode
      state.addNode(type, {
        sceneHash: typeof n.sceneHash === 'string' ? n.sceneHash : '',
        altText: typeof n.altText === 'string' ? n.altText : '',
        sceneJSON:
          typeof n.sceneJSON === 'string' && n.sceneJSON.length > 0
            ? n.sceneJSON
            : EMPTY_SCENE_JSON,
      })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'excalidraw',
    runner: (state, node) => {
      const sceneJSON =
        typeof node.attrs.sceneJSON === 'string' && node.attrs.sceneJSON.length > 0
          ? (node.attrs.sceneJSON as string)
          : EMPTY_SCENE_JSON
      // mdast `code` node with lang=excalidraw round-trips through
      // remark-stringify as a ```excalidraw fence with the value as body —
      // identical to the source markdown. We don't go through `state.write`
      // / `state.text` directly because that bypasses remark's fence-marker
      // detection (would emit indented blocks instead of fences when the
      // body contains backticks).
      state.addNode('code', undefined, sceneJSON, { lang: 'excalidraw' })
    },
  },
}))
