import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  args: { placeholder: 'Type something…' },
}
export default meta

type Story = StoryObj<typeof Input>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-[var(--space-3)] max-w-[320px]">
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-[var(--space-3)] max-w-[320px]">
      <Input placeholder="Default" />
      <Input placeholder="Disabled" disabled />
      <Input
        placeholder="Invalid"
        aria-invalid
        defaultValue="not-an-email"
      />
    </div>
  ),
}

export const Labelled: Story = {
  render: () => (
    <label
      className="flex flex-col gap-[var(--space-2)] max-w-[320px]"
      htmlFor="email"
    >
      <span className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
        Email
      </span>
      <Input id="email" type="email" placeholder="you@example.com" />
    </label>
  ),
}
