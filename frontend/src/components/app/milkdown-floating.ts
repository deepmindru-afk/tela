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

// Viewport-coordinate anchor (from view.coordsAtPos or getBoundingClientRect).
export interface FloatAnchor {
  top: number
  bottom: number
  left: number
}

export interface FloatOptions {
  // Preferred side relative to the anchor; flips to the other side on overflow.
  place: 'below' | 'above'
  // Gap in px between anchor and element (default 4).
  gap?: number
  // Horizontal: 'start' aligns the element's left edge to anchor.left; 'center'
  // centers the element on anchor.left (pass the selection midpoint as left).
  align?: 'start' | 'center'
  // Clamp the element fully inside the viewport vertically (slash menu does;
  // the selection bubble deliberately does not).
  clampVertical?: boolean
  // Viewport edge margin in px (default 4).
  margin?: number
}

// Position a floating element near an anchor: place it on the preferred side,
// then re-measure after paint to flip to the opposite side if it would overflow
// and clamp it inside the viewport. The place/flip/clamp logic lives here so the
// slash menu, selection bubble, and link popover share one implementation
// instead of hand-rolling near-identical rAF math. Returns a cleanup that
// cancels the pending measurement (call it from the effect's teardown).
export function positionFloating(
  el: HTMLElement,
  anchor: FloatAnchor,
  opts: FloatOptions,
): () => void {
  const gap = opts.gap ?? 4
  const margin = opts.margin ?? 4
  const center = opts.align === 'center'
  // Pre-measure placement so there's no first-paint flash at the wrong spot.
  setPos(el, anchor.left, opts.place === 'below' ? anchor.bottom + gap : anchor.top)
  const rafId = requestAnimationFrame(() => {
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth
    let top: number
    if (opts.place === 'below') {
      top = anchor.bottom + gap
      // Overflows the bottom and there's more room above → flip up.
      if (top + r.height > vh && anchor.top > vh - anchor.bottom) {
        top = anchor.top - r.height - gap
      }
    } else {
      top = anchor.top - r.height - gap
      // No room above → flip below the anchor.
      if (top < margin) top = anchor.bottom + gap
    }
    if (opts.clampVertical) {
      top = Math.max(margin, Math.min(top, vh - r.height - margin))
    }
    let left = center ? anchor.left - r.width / 2 : anchor.left
    left = Math.max(margin, Math.min(left, vw - r.width - margin))
    setPos(el, left, top)
  })
  return () => cancelAnimationFrame(rafId)
}
