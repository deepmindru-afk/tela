import type { Meta, StoryObj } from '@storybook/react-vite'
import { Bold, Italic, Underline } from 'lucide-react'
import { Toggle, ToggleGroup, ToggleGroupItem } from './toggle'

const meta: Meta<typeof Toggle> = {
  title: 'UI/Toggle',
  component: Toggle,
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
}
export default meta

type Story = StoryObj<typeof Toggle>

export const Single: Story = {
  args: { children: 'Bold' },
}

export const SingleWithIcon: Story = {
  render: () => (
    <Toggle aria-label="Toggle bold">
      <Bold width={16} height={16} />
    </Toggle>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-[var(--space-3)]">
      <Toggle size="sm">Small</Toggle>
      <Toggle size="md">Medium</Toggle>
      <Toggle size="lg">Large</Toggle>
    </div>
  ),
}

export const Group: Story = {
  render: () => (
    <ToggleGroup type="multiple" aria-label="Text formatting">
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold width={16} height={16} />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic width={16} height={16} />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline width={16} height={16} />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const GroupSingleSelect: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="md" aria-label="Density">
      <ToggleGroupItem value="sm">Compact</ToggleGroupItem>
      <ToggleGroupItem value="md">Comfortable</ToggleGroupItem>
      <ToggleGroupItem value="lg">Spacious</ToggleGroupItem>
    </ToggleGroup>
  ),
}
