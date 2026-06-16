import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { Transaction } from '@milkdown/kit/prose/state'
import { CellSelection } from '@milkdown/kit/prose/tables'
import { ySyncPluginKey } from 'y-prosemirror'

// Collab table-selection guard. y-prosemirror's selection restore
// (restoreRelativeSelection) only knows AllSelection / NodeSelection /
// TextSelection — there's no CellSelection case. It rebuilds the selection from
// `selection.anchor`/`selection.head`, but for a CellSelection BOTH of those
// point at the *head* cell (the constructor's `super(ranges[0]…)` uses the head
// cell's content range). So a multi-cell drag survives only as its head cell:
// after any sync transaction the binding dispatches, a cell selection collapses
// to a single cell. It only bites on a live (collab-connected) doc — offline
// there are no sync transactions, which is why it's invisible in a solo editor.
//
// y-prosemirror can't carry the anchor cell, so we track the live CellSelection's
// anchor+head cell positions ourselves and, when a sync transaction collapses it,
// re-apply the full CellSelection in the same dispatch (appendTransaction → no
// flicker). The table sits at stable absolute positions for the common case
// (the remote edit is elsewhere); if the positions no longer resolve to cells we
// bail and leave the collapsed selection as-is. Yjs-scoped: only wired in the
// editor's collab branch.

interface Tracked {
  anchorPos: number
  headPos: number
}

function isSyncTx(tr: Transaction): boolean {
  const meta = tr.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined
  return !!meta?.isChangeOrigin
}

const key = new PluginKey<Tracked | null>('tela-preserve-cell-selection')

export function createPreserveCellSelectionPlugin(): Plugin<Tracked | null> {
  return new Plugin<Tracked | null>({
    key,
    state: {
      init: () => null,
      apply: (tr, value, oldState, newState) => {
        // Remember the live cell selection's two corner cells.
        if (newState.selection instanceof CellSelection) {
          return {
            anchorPos: newState.selection.$anchorCell.pos,
            headPos: newState.selection.$headCell.pos,
          }
        }
        // A sync just collapsed our cell selection — keep the tracked positions
        // so appendTransaction can restore them this dispatch.
        if (isSyncTx(tr) && oldState.selection instanceof CellSelection) {
          return value
        }
        // Anything else (the user moved the selection) — forget.
        return null
      },
    },
    appendTransaction: (trs, oldState, newState) => {
      if (newState.selection instanceof CellSelection) return null
      if (!(oldState.selection instanceof CellSelection)) return null
      if (!trs.some(isSyncTx)) return null
      const tracked = key.getState(newState)
      if (!tracked) return null
      try {
        const sel = new CellSelection(
          newState.doc.resolve(tracked.anchorPos),
          newState.doc.resolve(tracked.headPos),
        )
        return newState.tr.setSelection(sel)
      } catch {
        return null
      }
    },
  })
}
