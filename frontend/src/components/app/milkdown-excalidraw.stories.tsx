import type { Meta, StoryObj } from '@storybook/react-vite'

// Showcase the M13.3a Excalidraw view-mode chrome. The editor renders the
// same class structure via excalidrawSchema.toDOM; here we hand-write the
// DOM so the story doesn't need a Milkdown editor mount and doesn't pull
// in the @excalidraw/excalidraw runtime (which only loads via the M13.3b
// Edit Sheet's dynamic import).
//
// The placeholder `<img>` uses an inline data-URI SVG so the story has no
// network dependency.

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 360' preserveAspectRatio='xMidYMid meet'%3E%3Crect width='600' height='360' fill='%23f0f4f8'/%3E%3Cg stroke='%23334155' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='80' y='80' width='160' height='80' rx='6'/%3E%3Cline x1='240' y1='120' x2='360' y2='120'/%3E%3Cpolyline points='350,110 360,120 350,130'/%3E%3Ccircle cx='420' cy='120' r='44'/%3E%3Cpath d='M 160 240 q 60 -40 120 0 t 120 0'/%3E%3C/g%3E%3Ctext x='160' y='126' fill='%23334155' font-family='sans-serif' font-size='20'%3EInput%3C/text%3E%3Ctext x='400' y='126' fill='%23334155' font-family='sans-serif' font-size='20'%3EOutput%3C/text%3E%3C/svg%3E"

interface ExcalidrawPreviewProps {
  sceneHash: string
  altText: string
  empty?: boolean
}

function ExcalidrawPreview({ sceneHash, altText, empty }: ExcalidrawPreviewProps) {
  if (empty) {
    return (
      <div
        className="tela-excalidraw tela-excalidraw--empty"
        data-scene-hash=""
        data-alt-text=""
      >
        [Empty diagram — Edit to draw]
      </div>
    )
  }
  return (
    <div
      className="tela-excalidraw"
      data-scene-hash={sceneHash}
      data-alt-text={altText}
    >
      <img src={PLACEHOLDER_SVG} alt={altText || 'Excalidraw diagram'} loading="lazy" />
    </div>
  )
}

const meta: Meta<typeof ExcalidrawPreview> = {
  title: 'App/Milkdown Excalidraw',
  component: ExcalidrawPreview,
  parameters: {
    layout: 'padded',
  },
}
export default meta

type Story = StoryObj<typeof ExcalidrawPreview>

export const Populated: Story = {
  name: 'Populated diagram (with PNG)',
  args: {
    sceneHash: 'abcdef0123456789',
    altText: 'A flowchart showing input → process → output',
  },
}

export const Empty: Story = {
  name: 'Empty placeholder (fresh slash-insert)',
  args: { sceneHash: '', altText: '', empty: true },
}

export const NoAltText: Story = {
  name: 'Populated with no alt text (fallback to "Excalidraw diagram")',
  args: { sceneHash: 'abcdef0123456789', altText: '' },
}
