// Idempotent DOM writes for the floating editor providers (slash menu, bubble
// toolbar, block handle). Their positioning effects run on EVERY editor
// transaction (the plugin-view adapter re-renders per PM update). Writing
// `data-show` / `style` unconditionally there causes per-keystroke attribute
// thrash — dozens-to-hundreds of redundant writes during a few seconds of
// typing, each one layout/observer work for no visible change. These helpers
// touch the DOM only when the value actually changes.

export function setShow(el: HTMLElement, show: boolean): void {
  const v = show ? 'true' : 'false'
  if (el.dataset.show !== v) el.dataset.show = v
}

export function setPos(el: HTMLElement, left: number, top: number): void {
  const l = `${left}px`
  const t = `${top}px`
  if (el.style.left !== l) el.style.left = l
  if (el.style.top !== t) el.style.top = t
}
