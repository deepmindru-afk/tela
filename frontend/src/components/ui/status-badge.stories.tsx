import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatusBadge } from './status-badge'

const meta: Meta<typeof StatusBadge> = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'positive', 'negative', 'warning', 'info', 'running'],
    },
    dot: { control: 'boolean' },
  },
  args: { children: 'Active', tone: 'neutral', dot: false },
}
export default meta

type Story = StoryObj<typeof StatusBadge>

export const Neutral: Story = { args: { tone: 'neutral', children: 'Idle' } }
export const Positive: Story = { args: { tone: 'positive', children: 'Done', dot: true } }
export const Negative: Story = { args: { tone: 'negative', children: 'Failed', dot: true } }
export const Warning: Story = { args: { tone: 'warning', children: 'Stale', dot: true } }
export const Info: Story = { args: { tone: 'info', children: 'Queued', dot: true } }
export const Running: Story = { args: { tone: 'running', children: 'Running', dot: true } }

const tones = ['neutral', 'positive', 'negative', 'warning', 'info', 'running'] as const

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div className="flex flex-wrap gap-[var(--space-3)] items-center">
        {tones.map((tone) => (
          <StatusBadge key={tone} tone={tone}>
            {tone}
          </StatusBadge>
        ))}
      </div>
      <div className="flex flex-wrap gap-[var(--space-3)] items-center">
        {tones.map((tone) => (
          <StatusBadge key={tone} tone={tone} dot>
            {tone}
          </StatusBadge>
        ))}
      </div>
    </div>
  ),
}

export const RunStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--space-3)] items-center">
      <StatusBadge tone="running" dot>
        running
      </StatusBadge>
      <StatusBadge tone="positive" dot>
        done
      </StatusBadge>
      <StatusBadge tone="negative" dot>
        failed
      </StatusBadge>
      <StatusBadge tone="warning" dot>
        stale
      </StatusBadge>
    </div>
  ),
}
