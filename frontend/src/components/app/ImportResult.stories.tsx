import type { Meta, StoryObj } from '@storybook/react-vite'
import { ImportResult } from './ImportResult'
import type { ImportResult as ImportResultPayload } from '../../lib/queries/imports'

const meta: Meta<typeof ImportResult> = {
  title: 'App/ImportResult',
  component: ImportResult,
  parameters: {
    layout: 'padded',
  },
}
export default meta

type Story = StoryObj<typeof ImportResult>

const successPayload: ImportResultPayload = {
  summary: { created: 5, skipped: 0, conflicts_renamed: 0 },
  pages: [
    { id: 101, title: 'Engineering', parent_id: null, path: 'engineering/' },
    {
      id: 102,
      title: 'On-call runbook',
      parent_id: 101,
      path: 'engineering/oncall.md',
    },
    {
      id: 103,
      title: 'Release process',
      parent_id: 101,
      path: 'engineering/releases.md',
    },
    {
      id: 104,
      title: 'Deploy targets',
      parent_id: 101,
      path: 'engineering/deploys.md',
    },
    {
      id: 105,
      title: 'Vendor list',
      parent_id: 101,
      path: 'engineering/vendors.md',
    },
  ],
  skipped: [],
  errors: [],
}

const partialPayload: ImportResultPayload = {
  summary: { created: 5, skipped: 3, conflicts_renamed: 2 },
  pages: [
    {
      id: 201,
      title: 'Designs',
      parent_id: null,
      path: 'designs/',
    },
    {
      id: 202,
      title: 'Home page (2)',
      parent_id: 201,
      path: 'designs/home.md',
    },
    {
      id: 203,
      title: 'Marketing site',
      parent_id: 201,
      path: 'designs/marketing.md',
    },
    {
      id: 204,
      title: 'Brand book (2)',
      parent_id: 201,
      path: 'designs/brand.md',
    },
    {
      id: 205,
      title: 'Icons',
      parent_id: 201,
      path: 'designs/icons.md',
    },
  ],
  skipped: [
    { path: 'designs/logo.png', reason: 'not_markdown' },
    { path: 'designs/.DS_Store', reason: 'not_markdown' },
    { path: 'designs/cover.jpg', reason: 'not_markdown' },
  ],
  errors: [],
}

const dryRunPayload: ImportResultPayload = {
  summary: { created: 4, skipped: 1, conflicts_renamed: 1 },
  pages: [
    { id: -1, title: 'Notes', parent_id: null, path: 'notes/' },
    { id: -2, title: 'Weekly review', parent_id: -1, path: 'notes/weekly.md' },
    { id: -3, title: 'Reading list', parent_id: -1, path: 'notes/reading.md' },
    { id: -4, title: 'Ideas (2)', parent_id: -1, path: 'notes/ideas.md' },
  ],
  skipped: [{ path: 'notes/.obsidian-config.json', reason: 'not_markdown' }],
  errors: [],
}

export const Success: Story = {
  name: 'Success — 5 created, 0 skipped',
  args: {
    result: successPayload,
    dryRun: false,
    onOpenFirstPage: () => {},
  },
}

export const Partial: Story = {
  name: 'Partial — 5 created, 3 skipped, 2 renamed',
  args: {
    result: partialPayload,
    dryRun: false,
    onOpenFirstPage: () => {},
  },
}

export const DryRun: Story = {
  name: 'Dry-run preview — 4 planned',
  args: {
    result: dryRunPayload,
    dryRun: true,
    onConfirm: () => {},
    onCancel: () => {},
    confirmPending: false,
  },
}
