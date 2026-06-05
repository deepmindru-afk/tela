// Tiny event bus for "open the command palette" requests, mirroring
// newPageEvent.ts. The palette lives in AppCommandHost (sibling of
// RouterProvider), but a visible Search button in the sidebar lives deep in the
// route tree — a window CustomEvent is the smallest bridge across that boundary,
// so mouse users get a click target for the same palette that ⌘K opens.

import type { CommandMode } from '../components/ui/command'

const OPEN_PALETTE_EVENT = 'tela:open-palette'

export function emitOpenPalette(mode: CommandMode = 'pages'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<CommandMode>(OPEN_PALETTE_EVENT, { detail: mode }),
  )
}

export function subscribeToOpenPalette(
  cb: (mode: CommandMode) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  function handler(e: Event) {
    cb((e as CustomEvent<CommandMode | undefined>).detail ?? 'pages')
  }
  window.addEventListener(OPEN_PALETTE_EVENT, handler)
  return () => window.removeEventListener(OPEN_PALETTE_EVENT, handler)
}
