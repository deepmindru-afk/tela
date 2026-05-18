import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import { Button } from './button'
import { Input } from './input'

const meta: Meta<typeof Dialog> = {
  title: 'UI/Dialog',
  component: Dialog,
}
export default meta

type Story = StoryObj<typeof Dialog>

export const Basic: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new space</DialogTitle>
          <DialogDescription>
            Spaces hold a tree of pages. You can rename or move them later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-[var(--space-2)]">
          <label
            htmlFor="space-name"
            className="text-[length:var(--text-sm)] text-[var(--text-muted)]"
          >
            Name
          </label>
          <Input id="space-name" placeholder="e.g. Engineering" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="primary">Create</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

export const Confirmation: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger">Delete page</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this page?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The page and its children will be
            removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger">Delete</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
