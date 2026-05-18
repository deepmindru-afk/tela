import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowRight, Trash2 } from 'lucide-react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Save changes' },
}
export default meta

type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { variant: 'primary' } }
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete account' },
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--space-3)] items-center">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--space-3)] items-center">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--space-3)] items-center">
      <Button disabled>Primary</Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="ghost" disabled>
        Ghost
      </Button>
      <Button variant="danger" disabled>
        Danger
      </Button>
    </div>
  ),
}

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--space-3)] items-center">
      <Button>
        Continue <ArrowRight width={16} height={16} />
      </Button>
      <Button variant="danger">
        <Trash2 width={16} height={16} /> Delete
      </Button>
    </div>
  ),
}

export const AsChildLink: Story = {
  render: () => (
    <Button asChild variant="secondary">
      <a href="#anchor">Rendered as &lt;a&gt;</a>
    </Button>
  ),
}
