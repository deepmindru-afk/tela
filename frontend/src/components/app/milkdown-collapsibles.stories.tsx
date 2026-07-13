import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

// Showcase the M13.1 collapsible chrome. The editor renders the same class
// structure via detailsSchema.toDOM (host `<details>` with `tela-details`
// class); here we render plain React `<details>` so the story doesn't need a
// Milkdown editor mount. Browser-native disclosure click handling is shared
// between editor and story — both rely on the built-in HTMLDetailsElement
// behaviour.

interface CollapsiblePreviewProps {
  summary: string
  body: ReactNode
  open?: boolean
}

function CollapsiblePreview({ summary, body, open }: CollapsiblePreviewProps) {
  return (
    <details className="tela-details" open={open}>
      <summary>{summary}</summary>
      {body}
    </details>
  )
}

const meta: Meta<typeof CollapsiblePreview> = {
  title: 'App/Milkdown Collapsibles',
  component: CollapsiblePreview,
  parameters: {
    layout: 'padded',
  },
}
export default meta

type Story = StoryObj<typeof CollapsiblePreview>

export const Closed: Story = {
  args: {
    summary: 'Click to expand',
    body: (
      <p>
        Hidden body content. Click the summary above to reveal it.
      </p>
    ),
    open: false,
  },
}

export const Open: Story = {
  args: {
    summary: 'Already expanded',
    body: <p>This collapsible is rendered open by default via the `open` attribute.</p>,
    open: true,
  },
}

export const WithRichBody: Story = {
  name: 'Rich body content',
  render: () => (
    <CollapsiblePreview
      open
      summary="Implementation details"
      body={
        <>
          <p>
            Body content is normal markdown — <strong>bold</strong>,{' '}
            <em>italic</em>, <code>inline code</code>, and{' '}
            <a href="https://tla.portalos.ru">links</a> all flow through.
          </p>
          <ul>
            <li>Lists work too</li>
            <li>And other block elements</li>
          </ul>
        </>
      }
    />
  ),
}
