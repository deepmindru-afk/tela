import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from './checkbox'

const meta: Meta<typeof Checkbox> = {
  title: 'UI/Checkbox',
  component: Checkbox,
}
export default meta

type Story = StoryObj<typeof Checkbox>

export const Default: Story = {}

export const Checked: Story = { args: { defaultChecked: true } }

export const Disabled: Story = { args: { disabled: true } }

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
}

export const WithLabel: Story = {
  render: () => (
    <label className="flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-primary)] cursor-pointer">
      <Checkbox defaultChecked />
      <span>Make this user an instance admin</span>
    </label>
  ),
}
