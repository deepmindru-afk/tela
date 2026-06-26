import type { Meta, StoryObj } from '@storybook/react-vite'
import { CoverageGauge } from './coverage-gauge'

const meta: Meta<typeof CoverageGauge> = {
  title: 'UI/CoverageGauge',
  component: CoverageGauge,
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    caption: { control: 'text' },
  },
  args: { value: 0.78, size: 'md', caption: 'must-cover' },
}
export default meta

type Story = StoryObj<typeof CoverageGauge>

export const Low: Story = { args: { value: 0.42 } }
export const Mid: Story = { args: { value: 0.78 } }
export const High: Story = { args: { value: 0.95 } }

export const ToneBands: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--space-5)] items-end">
      <CoverageGauge value={0.42} caption="must-cover" />
      <CoverageGauge value={0.78} caption="must-cover" />
      <CoverageGauge value={0.95} caption="must-cover" />
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--space-5)] items-end">
      <CoverageGauge value={0.78} size="sm" caption="must-cover" />
      <CoverageGauge value={0.78} size="md" caption="must-cover" />
      <CoverageGauge value={0.78} size="lg" caption="must-cover" />
    </div>
  ),
}

export const WithoutCaption: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--space-5)] items-end">
      <CoverageGauge value={0.42} />
      <CoverageGauge value={0.78} />
      <CoverageGauge value={0.95} />
    </div>
  ),
}
