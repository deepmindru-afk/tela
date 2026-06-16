import { Plugin } from '@milkdown/kit/prose/state'
import { Fragment, Slice } from '@milkdown/kit/prose/model'
import type { Schema } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'

// Paste-as-plain-text escape hatch (Cmd/Ctrl+Shift+V). The editor's normal paste
// runs a stack of smart handlers — markdown parse, table rebuild, URL→embed/link,
// image upload. Sometimes you just want the raw characters with none of that.
// This plugin watches for the Shift+Mod+V chord and, on the paste that follows,
// inserts clipboard text/plain literally (no markdown parse, no smart handlers).
// Prepended ahead of every other paste handler so it wins when armed. Editable,
// non-share; one plugin, single + collab (plain view.dispatch).

// Each line becomes its own paragraph — the pasted text keeps its line shape
// without any of it being interpreted as markdown.
function plainSlice(schema: Schema, raw: string): Slice {
  const para = schema.nodes.paragraph
  const blocks = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => para.create(null, schema.text(line)))
  if (blocks.length === 0) return Slice.empty
  return new Slice(Fragment.fromArray(blocks), 1, 1)
}

function insertPlain(view: EditorView, raw: string) {
  const text = raw.replace(/\r\n?/g, '\n')
  if (!text.includes('\n')) {
    // Single line → inline insert at the caret (don't split the block).
    view.dispatch(view.state.tr.insertText(text).scrollIntoView())
    return
  }
  view.dispatch(view.state.tr.replaceSelection(plainSlice(view.state.schema, text)).scrollIntoView())
}

export function createPlainPastePlugin(): Plugin {
  let armed = false
  let disarm: ReturnType<typeof setTimeout> | undefined
  return new Plugin({
    props: {
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === 'v' || event.key === 'V')) {
          armed = true
          // Safety net: forget if no paste event actually follows the chord.
          if (disarm) clearTimeout(disarm)
          disarm = setTimeout(() => {
            armed = false
          }, 1000)
        }
        return false // never consume the key — the paste still needs to fire
      },
      handlePaste: (view, event) => {
        if (!armed) return false
        armed = false
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (!text) return false
        event.preventDefault()
        insertPlain(view, text)
        return true
      },
    },
  })
}
