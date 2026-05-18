import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { Button } from '../ui/button'
import { NewPageDialog } from './NewPageDialog'
import { pageKeys } from '../../lib/queries/pages'
import { spaceKeys } from '../../lib/queries/spaces'
import type { PageTreeNode, Space } from '../../lib/types'

const MOCK_SPACES: Space[] = [
  {
    id: 1,
    name: 'Engineering',
    slug: 'engineering',
    created_at: '',
    updated_at: '',
  },
  {
    id: 2,
    name: 'Operations',
    slug: 'operations',
    created_at: '',
    updated_at: '',
  },
  { id: 3, name: 'Design', slug: 'design', created_at: '', updated_at: '' },
]

function mkPage(
  id: number,
  spaceId: number,
  parentId: number | null,
  title: string,
  position: number,
  children: PageTreeNode[] = [],
): PageTreeNode {
  return {
    id,
    space_id: spaceId,
    parent_id: parentId,
    title,
    body: '',
    position,
    created_at: '',
    updated_at: '',
    children,
  }
}

const MOCK_TREE_ENG: PageTreeNode[] = [
  mkPage(10, 1, null, 'Onboarding', 0, [
    mkPage(11, 1, 10, 'Day 1', 0),
    mkPage(12, 1, 10, 'Tooling', 1),
  ]),
  mkPage(20, 1, null, 'Architecture', 1, [
    mkPage(21, 1, 20, 'Services', 0),
    mkPage(22, 1, 20, 'Data flow', 1, [
      mkPage(23, 1, 22, 'Ingest', 0),
      mkPage(24, 1, 22, 'Storage', 1),
    ]),
  ]),
  mkPage(30, 1, null, 'On-call runbook', 2),
]

const MOCK_TREE_OPS: PageTreeNode[] = [
  mkPage(40, 2, null, 'Q3 OKRs', 0),
  mkPage(41, 2, null, 'Vendors', 1, [
    mkPage(42, 2, 41, 'AWS', 0),
    mkPage(43, 2, 41, 'Cloudflare', 1),
  ]),
]

const MOCK_TREE_DESIGN: PageTreeNode[] = [
  mkPage(50, 3, null, 'Brand guidelines', 0),
]

function makeQueryClient(): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  qc.setQueryData(spaceKeys.list(), MOCK_SPACES)
  qc.setQueryData(pageKeys.tree(1), MOCK_TREE_ENG)
  qc.setQueryData(pageKeys.tree(2), MOCK_TREE_OPS)
  qc.setQueryData(pageKeys.tree(3), MOCK_TREE_DESIGN)
  return qc
}

// Minimal in-memory router so useNavigate() inside the dialog has a context.
// Clicking "Create page" still POSTs to /api/pages and fails in Storybook
// (no backend) — the story is for visual review of the dialog itself.
function makeRouter(content: React.ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <>{content}</>,
  })
  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
}

interface ProvidersProps {
  children: React.ReactNode
}

function Providers({ children }: ProvidersProps) {
  const qc = useMemo(() => makeQueryClient(), [])
  const router = useMemo(() => makeRouter(children), [children])
  return (
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const meta: Meta = {
  title: 'App/NewPageDialog',
  parameters: {
    layout: 'fullscreen',
  },
}
export default meta

type Story = StoryObj

export const FromPageContext: Story = {
  name: 'On a page — parent pre-fills to current page',
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <Providers>
        <div className="min-h-[80vh] p-[var(--space-7)]">
          <Button onClick={() => setOpen(true)}>Open new-page dialog</Button>
          <NewPageDialog
            open={open}
            onOpenChange={setOpen}
            defaultSpaceId={1}
            defaultParentId={22}
          />
        </div>
      </Providers>
    )
  },
}

export const FromSpaceContext: Story = {
  name: 'On a space (no page) — parent defaults to (top of space)',
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <Providers>
        <div className="min-h-[80vh] p-[var(--space-7)]">
          <Button onClick={() => setOpen(true)}>Open new-page dialog</Button>
          <NewPageDialog
            open={open}
            onOpenChange={setOpen}
            defaultSpaceId={1}
            defaultParentId={null}
          />
        </div>
      </Providers>
    )
  },
}

export const FromRootContext: Story = {
  name: 'At app root — falls back to first space',
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <Providers>
        <div className="min-h-[80vh] p-[var(--space-7)]">
          <Button onClick={() => setOpen(true)}>Open new-page dialog</Button>
          <NewPageDialog
            open={open}
            onOpenChange={setOpen}
            defaultSpaceId={null}
            defaultParentId={null}
          />
        </div>
      </Providers>
    )
  },
}

export const SpaceWithFewPages: Story = {
  name: 'Sparse space — picker shows only the (top of space) row',
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <Providers>
        <div className="min-h-[80vh] p-[var(--space-7)]">
          <Button onClick={() => setOpen(true)}>Open new-page dialog</Button>
          <NewPageDialog
            open={open}
            onOpenChange={setOpen}
            defaultSpaceId={3}
            defaultParentId={null}
          />
        </div>
      </Providers>
    )
  },
}
