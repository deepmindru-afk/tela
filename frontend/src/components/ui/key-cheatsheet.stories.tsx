import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { KeyCheatsheet } from './key-cheatsheet'
import { Button } from './button'
import type { KeyBinding } from '../../lib/keys/keymap'

const meta: Meta<typeof KeyCheatsheet> = {
  title: 'UI/KeyCheatsheet',
  component: KeyCheatsheet,
}
export default meta

type Story = StoryObj<typeof KeyCheatsheet>

// Injected so the story doesn't depend on the live registry (which only
// populates once KeymapHost imports the bindings module at app boot).
const SAMPLE: KeyBinding[] = [
  { id: 'go.home', keys: 'g h', label: 'Home', group: 'Go to', run: () => {} },
  { id: 'go.ask', keys: 'g a', label: 'Ask your docs', group: 'Go to', run: () => {} },
  { id: 'act.new', keys: 'c', label: 'Create page', group: 'Actions', run: () => {} },
  { id: 'act.theme', keys: 't', label: 'Toggle theme', group: 'Actions', run: () => {} },
  { id: 'move.down', keys: 'j', label: 'Down (next item / scroll)', group: 'Move', run: () => {} },
  { id: 'move.up', keys: 'k', label: 'Up (previous item / scroll)', group: 'Move', run: () => {} },
  { id: 'move.top', keys: 'g g', label: 'Jump to top', group: 'Move', run: () => {} },
  { id: 'move.activate', keys: ['Enter', 'o'], label: 'Open focused item', group: 'Move', run: () => {} },
  { id: 'read.next', keys: ']', label: 'Next heading', group: 'Reading', run: () => {} },
  { id: 'gen.help', keys: '?', label: 'Keyboard shortcuts', group: 'General', run: () => {} },
]

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Show shortcuts (?)</Button>
        <KeyCheatsheet open={open} onOpenChange={setOpen} bindings={SAMPLE} />
      </>
    )
  },
}
