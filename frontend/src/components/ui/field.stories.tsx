import type { Meta, StoryObj } from '@storybook/react-vite'
import { Field } from './field'
import { Input } from './input'

const meta: Meta<typeof Field> = {
  title: 'UI/Field',
  component: Field,
  args: { label: 'Label' },
  argTypes: {
    label: { control: 'text' },
    htmlFor: { control: 'text' },
  },
}
export default meta

type Story = StoryObj<typeof Field>

export const Default: Story = {
  render: (args) => (
    <div className="max-w-[320px]">
      <Field {...args}>
        <span className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Children content
        </span>
      </Field>
    </div>
  ),
}

export const WithInput: Story = {
  args: { label: 'Email', htmlFor: 'field-email' },
  render: (args) => (
    <div className="max-w-[320px]">
      <Field {...args}>
        <Input id="field-email" type="email" placeholder="you@example.com" />
      </Field>
    </div>
  ),
}

export const WithoutHtmlFor: Story = {
  args: { label: 'Notes' },
  render: (args) => (
    <div className="max-w-[320px]">
      <Field {...args}>
        <Input placeholder="No id wired — label is decorative" />
      </Field>
    </div>
  ),
}
