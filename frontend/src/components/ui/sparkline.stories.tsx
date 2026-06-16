import type { Meta, StoryObj } from '@storybook/react-vite'
import { Sparkline } from './sparkline'

const meta: Meta<typeof Sparkline> = {
  title: 'UI/Sparkline',
  component: Sparkline,
  args: {
    values: [3, 5, 4, 8, 6, 9, 7, 12, 10, 14, 11, 16],
    width: 160,
    height: 40,
    area: true,
  },
}
export default meta

type Story = StoryObj<typeof Sparkline>

// The Sparkline fills its container width (w-full), so stories give it a sized
// block box — mirroring how the dashboard cards constrain it.
export const Accent: Story = {
  render: (args) => (
    <div className="w-[200px] text-[var(--accent)]">
      <Sparkline {...args} />
    </div>
  ),
}

export const LineOnly: Story = {
  render: (args) => (
    <div className="w-[200px] text-[var(--text-primary)]">
      <Sparkline {...args} area={false} />
    </div>
  ),
}

export const Flat: Story = {
  render: (args) => (
    <div className="w-[200px] text-[var(--text-muted)]">
      <Sparkline {...args} values={[4, 4, 4, 4, 4]} />
    </div>
  ),
}

// Narrow box — proves the line scales to the container instead of overflowing.
export const Narrow: Story = {
  render: (args) => (
    <div className="w-[96px] text-[var(--accent)]">
      <Sparkline {...args} />
    </div>
  ),
}
