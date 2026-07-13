import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentType, ReactNode } from 'react'
import {
  Info,
  Lightbulb,
  CircleAlert,
  TriangleAlert,
  OctagonAlert,
} from 'lucide-react'
import {
  CALLOUT_LABELS,
  CALLOUT_TYPES,
  type CalloutType,
} from './milkdown-callouts'

// Showcase the M13.0 callout chrome. The editor renders the same class
// structure via calloutSchema.toDOM; here we render plain React + Lucide
// icons so the story doesn't need a Milkdown editor mount. The masked-SVG
// icons in the editor and the Lucide React components in the story are the
// same v1.16 path data, so the two surfaces stay visually aligned.

interface CalloutPreviewProps {
  type: CalloutType
  body: ReactNode
}

type IconComponent = ComponentType<{
  size?: number | string
  strokeWidth?: number | string
  className?: string
  'aria-hidden'?: boolean
}>

const ICONS: Record<CalloutType, IconComponent> = {
  note: Info,
  tip: Lightbulb,
  important: CircleAlert,
  warning: TriangleAlert,
  caution: OctagonAlert,
}

function CalloutPreview({ type, body }: CalloutPreviewProps) {
  const Icon = ICONS[type]
  return (
    <div
      className={`tela-callout tela-callout-${type}`}
      data-callout-type={type}
    >
      <div className="tela-callout-header" contentEditable={false}>
        <Icon size="1em" strokeWidth={2} aria-hidden />
        <span className="tela-callout-label">{CALLOUT_LABELS[type]}</span>
      </div>
      <div className="tela-callout-body">{body}</div>
    </div>
  )
}

const meta: Meta<typeof CalloutPreview> = {
  title: 'App/Milkdown Callouts',
  component: CalloutPreview,
  parameters: {
    layout: 'padded',
  },
}
export default meta

type Story = StoryObj<typeof CalloutPreview>

const BODY_NOTE: ReactNode = (
  <p>Useful information that users should know, even when skimming content.</p>
)
const BODY_TIP: ReactNode = (
  <p>Helpful advice for doing things better or more easily.</p>
)
const BODY_IMPORTANT: ReactNode = (
  <p>Key information users need to know to achieve their goal.</p>
)
const BODY_WARNING: ReactNode = (
  <p>Urgent info that needs immediate user attention to avoid problems.</p>
)
const BODY_CAUTION: ReactNode = (
  <p>Advises about risks or negative outcomes of certain actions.</p>
)

const BODIES: Record<CalloutType, ReactNode> = {
  note: BODY_NOTE,
  tip: BODY_TIP,
  important: BODY_IMPORTANT,
  warning: BODY_WARNING,
  caution: BODY_CAUTION,
}

export const Note: Story = {
  args: { type: 'note', body: BODY_NOTE },
}
export const Tip: Story = {
  args: { type: 'tip', body: BODY_TIP },
}
export const Important: Story = {
  args: { type: 'important', body: BODY_IMPORTANT },
}
export const Warning: Story = {
  args: { type: 'warning', body: BODY_WARNING },
}
export const Caution: Story = {
  args: { type: 'caution', body: BODY_CAUTION },
}

export const AllTypes: Story = {
  name: 'All 5 types — stacked',
  render: () => (
    <div className="flex flex-col gap-[var(--space-4)] max-w-[40rem]">
      {CALLOUT_TYPES.map((t) => (
        <CalloutPreview key={t} type={t} body={BODIES[t]} />
      ))}
    </div>
  ),
}

export const RichBody: Story = {
  name: 'Tip — rich body content',
  render: () => (
    <CalloutPreview
      type="tip"
      body={
        <>
          <p>
            Body content is normal markdown — <strong>bold</strong>,{' '}
            <em>italic</em>, <code>inline code</code>, and{' '}
            <a href="https://tla.portalos.ru">links</a> all flow through.
          </p>
          <ul>
            <li>Lists work too</li>
            <li>And nested blocks</li>
          </ul>
        </>
      }
    />
  ),
}
