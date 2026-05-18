import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'
import { Button } from './button'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
}
export default meta

type Story = StoryObj<typeof Card>

export const Basic: Story = {
  render: () => (
    <Card className="max-w-[480px]">
      <CardHeader>
        <CardTitle>Spaces</CardTitle>
        <CardDescription>
          A grouping of pages that share a theme or audience.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <p className="m-0">
          Cards are token-driven surfaces: their radius, padding, border, and
          background all flow from the same custom properties used by every
          other primitive.
        </p>
      </CardBody>
      <CardFooter>
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Create space</Button>
      </CardFooter>
    </Card>
  ),
}

export const HeaderOnly: Story = {
  render: () => (
    <Card className="max-w-[480px]">
      <CardHeader>
        <CardTitle>No body needed</CardTitle>
        <CardDescription>
          Sub-components are optional — compose what the use case requires.
        </CardDescription>
      </CardHeader>
    </Card>
  ),
}

export const Stack: Story = {
  render: () => (
    <div className="flex flex-col gap-[var(--space-4)] max-w-[480px]">
      <Card>
        <CardBody>One body-only card.</CardBody>
      </Card>
      <Card>
        <CardBody>Another stacked card.</CardBody>
      </Card>
    </div>
  ),
}
