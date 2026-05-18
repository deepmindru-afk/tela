// Tiny event bus for "open new-page dialog" requests. The dialog lives in
// AppCommandHost (sibling of RouterProvider so it can reach the query cache),
// but the sidebar "+ New page" button lives deep inside the route tree. A
// window CustomEvent is the smallest bridge — matches the pattern already used
// for theme changes (see theme.ts).

const OPEN_NEW_PAGE_EVENT = 'tela:open-new-page'

export function emitOpenNewPage(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_NEW_PAGE_EVENT))
}

export function subscribeToOpenNewPage(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  function handler() {
    cb()
  }
  window.addEventListener(OPEN_NEW_PAGE_EVENT, handler)
  return () => window.removeEventListener(OPEN_NEW_PAGE_EVENT, handler)
}
