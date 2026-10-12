import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  MiniMap,
  TransformComponent,
  TransformWrapper,
  useControls,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch'
import { Maximize, Minus, Plus, X } from 'lucide-react'
import { cn } from '../../lib/utils'

// zoom-viewer: a full-screen pan/zoom stage for one large visual (a diagram, an
// image). Wheel or pinch to zoom, drag to pan, double-click to zoom in; opens
// fitted to the screen, and a minimap appears once the content outgrows it.
// Keys: + / - zoom, 0 fit, 1 actual size, arrows pan, Esc closes.
//
// The caller gives the content's natural size and content that fills whatever
// box it is put in (an <svg> with a viewBox at 100%, an <img> at 100%). The
// stage LAYS IT OUT at the fitted size and zooms with a transform relative to
// that. Laying it out at natural size and transform-scaling down is the obvious
// way and is wrong on phones: Chrome's text autosizer works from layout width,
// ignores transforms, and inflated every label of a 2400px-wide diagram to
// several times its size when shown at 12%.

// A fitted tiny diagram blown up to 6x reads as broken, not as "fit".
const FIT_MAX = 2
// Screen-space margin around a fitted view; the vertical one clears the zoom pill.
const FIT_MARGIN_X = 48
const FIT_MARGIN_Y = 80
// Zoom range in true (natural-size) scale.
const MIN_ZOOM = 0.05
const MAX_ZOOM = 8
const ZOOM_STEP = 0.5
const ANIM_MS = 220
// Inline on purpose: the library's own (unlayered) CSS sizes the wrapper to its
// content, and unlayered rules beat our @layer components.
const STAGE_STYLE = { width: '100%', height: '100%' }

export interface ZoomViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  // Natural size of the content, in CSS px (what "100%" means).
  width: number
  height: number
  // Extra header buttons (download, copy, ...), placed before the close button.
  actions?: ReactNode
  children: ReactNode
}

export function ZoomViewer({
  open,
  onOpenChange,
  title,
  width,
  height,
  actions,
  children,
}: ZoomViewerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="tela-dialog-overlay tela-zoom-overlay" />
        <DialogPrimitive.Content
          className="tela-zoom-viewer"
          aria-describedby={undefined}
          // Focus the viewer itself, not its first button: keys work at once
          // and no focus ring sits on Download.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).focus()
          }}
        >
          <header className="tela-zoom-header">
            <DialogPrimitive.Title className="tela-zoom-title">{title}</DialogPrimitive.Title>
            <div className="tela-zoom-actions">
              {actions}
              <DialogPrimitive.Close className="tela-zoom-btn" aria-label="Close">
                <X width={16} height={16} aria-hidden />
              </DialogPrimitive.Close>
            </div>
          </header>
          {open ? (
            <Stage width={width} height={height}>
              {children}
            </Stage>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// Scale that puts a w x h box wholly inside the area, margins kept, capped.
function fitScale(area: HTMLElement, w: number, h: number, max: number) {
  return Math.min(
    (area.clientWidth - 2 * FIT_MARGIN_X) / w,
    (area.clientHeight - 2 * FIT_MARGIN_Y) / h,
    max,
  )
}

type StageRef = Pick<ReactZoomPanPinchRef, 'instance' | 'state' | 'setTransform'>

// Back to the fitted view: transform scale 1 at open, recomputed in case the
// window resized since. `base` converts the FIT_MAX cap into transform units.
function fitStage(c: StageRef, base: number, ms = ANIM_MS) {
  const area = c.instance.wrapperComponent
  const content = c.instance.contentComponent
  if (!area || !content) return Promise.resolve()
  const w = content.offsetWidth
  const h = content.offsetHeight
  const s = fitScale(area, w, h, FIT_MAX / base)
  return c.setTransform((area.clientWidth - w * s) / 2, (area.clientHeight - h * s) / 2, s, ms)
}

function Stage({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: ReactNode
}) {
  const area = useRef<HTMLDivElement>(null)
  // Layout scale: content is laid out at natural size x base, which is the fit.
  const [base, setBase] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    if (area.current) setBase(fitScale(area.current, width, height, FIT_MAX))
  }, [width, height])

  // One read of the transform feeds the % label and the minimap's visibility.
  const sync = useCallback(({ instance, state }: Pick<StageRef, 'instance' | 'state'>) => {
    const stage = instance.wrapperComponent
    const content = instance.contentComponent
    setZoom(state.scale)
    if (!stage || !content) return
    setOver(
      content.offsetWidth * state.scale > stage.clientWidth + 1 ||
        content.offsetHeight * state.scale > stage.clientHeight + 1,
    )
  }, [])

  const frame = base ? (
    <div className="tela-zoom-frame" style={{ width: width * base, height: height * base }}>
      {children}
    </div>
  ) : null

  return (
    <div ref={area} className="tela-zoom-area">
      {base && frame ? (
        <TransformWrapper
          initialScale={1}
          minScale={MIN_ZOOM / base}
          maxScale={MAX_ZOOM / base}
          centerOnInit
          centerZoomedOut
          limitToBounds
          doubleClick={{ step: 0.7, animationTime: ANIM_MS }}
          onTransform={sync}
          onInit={sync}
        >
          <StageKeys base={base} />
          <TransformComponent wrapperClass="tela-zoom-stage" wrapperStyle={STAGE_STYLE}>
            {frame}
          </TransformComponent>
          <div className="tela-zoom-minimap" data-show={over} aria-hidden>
            <MiniMap width={180} height={120} borderColor="var(--accent)">
              {frame}
            </MiniMap>
          </div>
          <Toolbar base={base} zoom={zoom} />
          <p className="tela-zoom-hint" aria-hidden>
            Scroll or pinch to zoom, drag to pan
          </p>
        </TransformWrapper>
      ) : null}
    </div>
  )
}

function Toolbar({ base, zoom }: { base: number; zoom: number }) {
  const controls = useControls()
  return (
    <div className="tela-zoom-toolbar" role="toolbar" aria-label="Zoom">
      <button
        type="button"
        className="tela-zoom-btn"
        aria-label="Zoom out"
        title="Zoom out (-)"
        onClick={() => void controls.zoomOut(ZOOM_STEP, ANIM_MS)}
      >
        <Minus width={16} height={16} aria-hidden />
      </button>
      <button
        type="button"
        className="tela-zoom-btn tela-zoom-pct"
        aria-label="Actual size"
        title="Actual size (1)"
        onClick={() => void controls.centerView(1 / base, ANIM_MS)}
      >
        {Math.round(base * zoom * 100)}%
      </button>
      <button
        type="button"
        className="tela-zoom-btn"
        aria-label="Zoom in"
        title="Zoom in (+)"
        onClick={() => void controls.zoomIn(ZOOM_STEP, ANIM_MS)}
      >
        <Plus width={16} height={16} aria-hidden />
      </button>
      <span className="tela-zoom-sep" aria-hidden />
      <button
        type="button"
        className="tela-zoom-btn"
        title="Fit to screen (0)"
        onClick={() => void fitStage(controls, base)}
      >
        <Maximize width={15} height={15} aria-hidden />
        Fit
      </button>
    </div>
  )
}

// Viewer keys, bound on the window while the stage is mounted (the dialog is
// modal, and the global keymap already stands down inside a dialog).
function StageKeys({ base }: { base: number }) {
  const c = useControls()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const pan = 80
      const act: Record<string, () => unknown> = {
        '+': () => c.zoomIn(ZOOM_STEP, ANIM_MS),
        '=': () => c.zoomIn(ZOOM_STEP, ANIM_MS),
        '-': () => c.zoomOut(ZOOM_STEP, ANIM_MS),
        '0': () => fitStage(c, base),
        '1': () => c.centerView(1 / base, ANIM_MS),
        ArrowLeft: () => c.panBy(pan, 0, ANIM_MS),
        ArrowRight: () => c.panBy(-pan, 0, ANIM_MS),
        ArrowUp: () => c.panBy(0, pan, ANIM_MS),
        ArrowDown: () => c.panBy(0, -pan, ANIM_MS),
      }
      const fn = act[e.key]
      if (!fn) return
      e.preventDefault()
      void fn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [c, base])
  return null
}

// Header action button with the viewer's chrome, for consumers' `actions`.
export function ZoomViewerAction({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('tela-zoom-btn', className)} {...props} />
}
