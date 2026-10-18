import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from './button'
import { ZoomViewer, ZoomViewerAction } from './zoom-viewer'

// A wide sequence-diagram-ish SVG built in place, so the story needs no mermaid:
// the viewer only needs the natural size and content that fills its box.
function WideSvg({ lanes }: { lanes: number }) {
  const w = lanes * 180
  const h = 520
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Sample diagram">
      {Array.from({ length: lanes }, (_, i) => {
        const x = i * 180 + 90
        return (
          <g key={i}>
            <rect x={x - 70} y={16} width={140} height={44} rx={6} fill="var(--surface-3)" stroke="var(--accent)" />
            <text x={x} y={43} textAnchor="middle" fill="var(--text-primary)" fontSize={14}>
              Service {i + 1}
            </text>
            <line x1={x} y1={60} x2={x} y2={h - 16} stroke="var(--text-muted)" strokeDasharray="4 4" />
          </g>
        )
      })}
      {Array.from({ length: lanes * 2 }, (_, i) => {
        const from = (i * 7) % lanes
        const to = (i * 5 + 1) % lanes
        const y = 90 + i * 22
        return (
          <g key={i}>
            <line x1={from * 180 + 90} y1={y} x2={to * 180 + 90} y2={y} stroke="var(--text-muted)" />
            <text x={(from + to) * 90 + 90} y={y - 5} textAnchor="middle" fill="var(--text-primary)" fontSize={11}>
              call #{i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Demo({ startOpen = false, lanes = 9 }: { startOpen?: boolean; lanes?: number }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Open viewer
      </Button>
      <ZoomViewer
        open={open}
        onOpenChange={setOpen}
        title="Sequence diagram"
        width={lanes * 180}
        height={520}
        actions={
          <ZoomViewerAction aria-label="Download SVG" title="Download SVG">
            <Download width={16} height={16} aria-hidden />
          </ZoomViewerAction>
        }
      >
        <WideSvg lanes={lanes} />
      </ZoomViewer>
    </>
  )
}

const meta: Meta<typeof ZoomViewer> = {
  title: 'UI/ZoomViewer',
  component: ZoomViewer,
}
export default meta

type Story = StoryObj<typeof ZoomViewer>

export const Closed: Story = { render: () => <Demo /> }
export const OpenWide: Story = { render: () => <Demo startOpen /> }
export const OpenSmall: Story = { render: () => <Demo startOpen lanes={2} /> }
