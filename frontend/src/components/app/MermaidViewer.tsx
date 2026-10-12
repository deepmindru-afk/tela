import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Download } from 'lucide-react'
import { ZoomViewer, ZoomViewerAction } from '../ui/zoom-viewer'
import { mermaidSvg } from '../../lib/diagrams/mermaid'
import { subscribeToTheme } from '../../lib/theme'

// Full-screen pan/zoom view of one mermaid diagram, opened by clicking the
// inline diagram or its expand button (lib/diagrams/mermaid.ts). That
// element is vanilla DOM shared by the editor and the reader, so the viewer
// mounts its own React root on open and tears it down after it closes; this
// module is lazy-imported, so neither React tree pays for it up front.

export function openMermaidViewer(code: string) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const dispose = () => {
    root.unmount()
    host.remove()
  }
  root.render(<MermaidViewer code={code} onClosed={dispose} />)
}

// Out-animation length of the dialog (--duration-fast) plus slack.
const CLOSE_MS = 250

// Never hot-reloaded on its own: it only exists inside openMermaidViewer's root.
// eslint-disable-next-line react-refresh/only-export-components
function MermaidViewer({ code, onClosed }: { code: string; onClosed: () => void }) {
  const [open, setOpen] = useState(true)
  const [svg, setSvg] = useState<string | null>(null)

  // Same cached render as the inline diagram; re-fetched on a theme switch so
  // the colours follow it while the viewer is open.
  useEffect(() => {
    let live = true
    const load = () =>
      void mermaidSvg(code)
        .then((s) => live && setSvg(s))
        .catch(() => live && setOpen(false))
    load()
    const off = subscribeToTheme(load)
    return () => {
      live = false
      off()
    }
  }, [code])

  useEffect(() => {
    if (open) return
    const t = setTimeout(onClosed, CLOSE_MS)
    return () => clearTimeout(t)
  }, [open, onClosed])

  const view = useMemo(() => (svg ? standalone(svg) : null), [svg])
  if (!view) return null
  const title = diagramTitle(code, view.kind)

  return (
    <ZoomViewer
      open={open}
      onOpenChange={setOpen}
      title={title}
      width={view.width}
      height={view.height}
      actions={
        <ZoomViewerAction
          aria-label="Download SVG"
          title="Download SVG"
          onClick={() => download(view, title)}
        >
          <Download width={16} height={16} aria-hidden />
        </ZoomViewerAction>
      }
    >
      <div className="tela-mermaid-full" dangerouslySetInnerHTML={{ __html: view.markup }} />
    </ZoomViewer>
  )
}

type Standalone = { markup: string; kind: string; width: number; height: number }

// The viewer lays the svg out in a box of its own choosing, so it has to fill
// that box (mermaid emits `width="100%" style="max-width: Npx"`); its natural
// size is the viewBox. The copy also gets a fresh id: mermaid scopes its <style>
// and arrow markers by the svg id, and the inline diagram is still in the
// document under the old one.
function standalone(svg: string): Standalone | null {
  const box = document.createElement('div')
  box.innerHTML = svg
  const el = box.querySelector('svg')
  const vb = el?.viewBox.baseVal
  if (!el || !vb?.width || !vb.height) return null
  el.setAttribute('width', '100%')
  el.setAttribute('height', '100%')
  el.style.removeProperty('max-width')
  const kind = el.getAttribute('aria-roledescription') ?? ''
  const id = el.id
  const markup = id ? el.outerHTML.split(id).join(id + '-full') : el.outerHTML
  return { markup, kind, width: vb.width, height: vb.height }
}

const KIND_NAMES: Record<string, string> = {
  flowchart: 'Flowchart',
  'flowchart-v2': 'Flowchart',
  sequence: 'Sequence diagram',
  class: 'Class diagram',
  classDiagram: 'Class diagram',
  stateDiagram: 'State diagram',
  er: 'Entity relationship diagram',
  gantt: 'Gantt chart',
  pie: 'Pie chart',
  journey: 'User journey',
  gitGraph: 'Git graph',
  mindmap: 'Mind map',
  timeline: 'Timeline',
  quadrantChart: 'Quadrant chart',
  architecture: 'Architecture diagram',
}

// The diagram's own `title:` (frontmatter) or `accTitle:`, else its kind.
function diagramTitle(code: string, kind: string): string {
  const own = /^\s*(?:title|accTitle)(?:\s*:\s*|\s+)(.+?)\s*$/m.exec(code)?.[1]
  return own?.replace(/^["']|["']$/g, '') || KIND_NAMES[kind] || 'Diagram'
}

// The file gets the natural pixel size back, so it opens at 100% on its own.
function download(view: Standalone, title: string) {
  const box = document.createElement('div')
  box.innerHTML = view.markup
  const el = box.querySelector('svg')!
  el.setAttribute('width', String(Math.ceil(view.width)))
  el.setAttribute('height', String(Math.ceil(view.height)))
  const blob = new Blob([el.outerHTML], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram') + '.svg'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
