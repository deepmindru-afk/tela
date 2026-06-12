import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShieldAlert } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Button } from './button'

const meta: Meta<typeof Popover> = {
  title: 'UI/Popover',
  component: Popover,
}
export default meta

type Story = StoryObj<typeof Popover>

export const Basic: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
          Richer than a tooltip — holds links, prose, and small lists.
        </p>
      </PopoverContent>
    </Popover>
  ),
}

// The shape the dispute strip uses: a danger trigger opening a titled list of
// conflicting pages, each with a reason.
export const DisputeList: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--danger)] bg-transparent border-0 cursor-pointer"
        >
          <ShieldAlert width={12} height={12} aria-hidden /> 2 may dispute this
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="m-0 mb-[var(--space-2)] text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
          Possible contradictions
        </p>
        <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-2)]">
          {[
            ['Domain Context', 'Runs on port 2480 while reporting service runs on 8444'],
            ['Report Generator', 'Triggered by HTTP GET vs scheduled; different ports and data sources'],
          ].map(([title, reason]) => (
            <li key={title} className="flex flex-col gap-[2px]">
              <span className="text-[length:var(--text-sm)] text-[var(--accent)] font-medium font-[family-name:var(--font-sans)]">
                {title}
              </span>
              <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
                {reason}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  ),
}
