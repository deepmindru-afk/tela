import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './tooltip'
import { Button } from './button'

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
}
export default meta

type Story = StoryObj<typeof Tooltip>

export const Basic: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="secondary">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>Tokens-driven tooltip.</TooltipContent>
    </Tooltip>
  ),
}

export const Sides: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-[var(--space-6)] place-items-center py-[var(--space-8)]">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary">Top</Button>
        </TooltipTrigger>
        <TooltipContent side="top">Top tooltip</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary">Right</Button>
        </TooltipTrigger>
        <TooltipContent side="right">Right tooltip</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary">Bottom</Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Bottom tooltip</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary">Left</Button>
        </TooltipTrigger>
        <TooltipContent side="left">Left tooltip</TooltipContent>
      </Tooltip>
    </div>
  ),
}
