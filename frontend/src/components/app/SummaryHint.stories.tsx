import type { Meta, StoryObj } from '@storybook/react-vite'
import { SummaryTitle } from './SummaryHint'

const meta = {
  title: 'App/SummaryTitle',
  component: SummaryTitle,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SummaryTitle>

export default meta
type Story = StoryObj<typeof meta>

const title = (
  <h1 className="m-0 text-[length:var(--text-3xl)] leading-[var(--leading-tight)] font-medium text-[var(--text-primary)]">
    The Token Tax
  </h1>
)

// Hover the title: the gutter icon fades in and the summary card opens.
export const Default: Story = {
  args: {
    summary:
      'What actually moves token cost, measured end-to-end against Claude Opus 4.8. Language is the biggest lever; politeness is free.',
    hintClassName: 'absolute left-[calc(-1*var(--space-6))] top-[var(--space-1)] inline-flex',
    children: title,
  },
  decorators: [(Story) => <div className="max-w-[36rem] pl-[var(--space-7)]">{Story()}</div>],
}

export const LongSummary: Story = {
  ...Default,
  args: {
    ...Default.args,
    summary:
      'A comparative report on solar and wind power covering cost trends, capacity growth, notable milestones, and an honest accounting of where each technology wins or loses depending on geography, storage availability, and grid maturity.',
  },
}

// No summary → the bare title, zero added chrome.
export const NoSummary: Story = {
  ...Default,
  args: { ...Default.args, summary: null },
}
