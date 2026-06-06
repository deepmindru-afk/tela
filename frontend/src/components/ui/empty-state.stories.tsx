import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileQuestion, SearchX, TriangleAlert, FolderOpen } from 'lucide-react'
import { EmptyState } from './empty-state'
import { Button } from './button'

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  args: {
    icon: FileQuestion,
    title: 'Page not found',
    description: "That page doesn't exist or you don't have access to it.",
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['default', 'danger'] },
    fullScreen: { control: 'boolean' },
  },
}
export default meta

type Story = StoryObj<typeof EmptyState>

export const NotFound: Story = {
  args: {
    actions: (
      <Button asChild variant="primary" size="md">
        <a href="#">Back to tela</a>
      </Button>
    ),
  },
}

export const LoadError: Story = {
  args: {
    icon: TriangleAlert,
    tone: 'danger',
    title: "Couldn't load this page",
    description: 'Something went wrong reaching the server. Try again.',
    actions: (
      <Button variant="secondary" size="md">
        Retry
      </Button>
    ),
  },
}

export const EmptyList: Story = {
  args: {
    icon: FolderOpen,
    title: 'No pages yet',
    description: 'Create the first page in this space to get started.',
    actions: (
      <Button variant="primary" size="md">
        New page
      </Button>
    ),
  },
}

export const NoActions: Story = {
  args: {
    icon: SearchX,
    title: 'No results',
    description: 'No pages match your search.',
  },
}

export const FullScreen: Story = {
  parameters: { layout: 'fullscreen' },
  args: {
    fullScreen: true,
    actions: (
      <Button asChild variant="primary" size="md">
        <a href="#">Back to tela</a>
      </Button>
    ),
  },
}
