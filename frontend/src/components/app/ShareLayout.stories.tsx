import { useMemo } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { ShareSidebar } from './ShareLayout'

interface MockPage {
  id: number
  title: string
  parent_id: number | null
}

// Mount the sidebar inside a memory router that registers the same
// /share/$token and /share/$token/p/$pageId path patterns the real router
// uses. Link components inside the sidebar build hrefs via these patterns;
// without them, type-safe `Link to="/share/$token/..."` would fail at
// render time. Each story can pick its own initial pathname so we can
// exercise the active-page styling (and the auto-expand effect that reads
// the pageId param).
function makeRouter(initialPath: string, content: React.ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <>{content}</>,
  })
  const shareRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/share/$token',
    component: () => <>{content}</>,
  })
  const shareDescendantRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/share/$token/p/$pageId',
    parseParams: (raw) => ({
      token: String(raw.token),
      pageId: Number(raw.pageId),
    }),
    stringifyParams: (params) => ({
      token: String(params.token),
      pageId: String(params.pageId),
    }),
    component: () => <>{content}</>,
  })
  const routeTree = rootRoute.addChildren([shareRoute, shareDescendantRoute])
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
}

interface ProvidersProps {
  initialPath: string
  children: React.ReactNode
}

function Providers({ initialPath, children }: ProvidersProps) {
  const qc = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  )
  const router = useMemo(() => makeRouter(initialPath, children), [initialPath, children])
  return (
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

interface SidebarHostProps {
  token: string
  pages: MockPage[]
  initialPath: string
}

function SidebarHost({ token, pages, initialPath }: SidebarHostProps) {
  return (
    <Providers initialPath={initialPath}>
      <div className="min-h-[80vh] flex bg-[var(--surface-1)]">
        <ShareSidebar token={token} pages={pages} />
        <div className="flex-1 p-[var(--space-6)]">
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            (Reader pane — out of frame for this story.)
          </p>
        </div>
      </div>
    </Providers>
  )
}

const meta: Meta = {
  title: 'App/ShareLayout',
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj

// Flat: root + 5 sibling leaves. No chevrons render — every row gets the
// icon-sized spacer so titles align. Active page is the root.
export const FlatLeafSidebar: Story = {
  name: 'Flat leaves — no chevrons',
  render: () => (
    <SidebarHost
      token="flat-token-aaaa1111"
      initialPath="/share/flat-token-aaaa1111"
      pages={[
        { id: 100, title: 'Engineering handbook', parent_id: null },
        { id: 101, title: 'How we work', parent_id: 100 },
        { id: 102, title: 'Code review', parent_id: 100 },
        { id: 103, title: 'On-call', parent_id: 100 },
        { id: 104, title: 'Postmortem template', parent_id: 100 },
        { id: 105, title: 'Untitled', parent_id: 100 },
      ]}
    />
  ),
}

// Nested: root with 3 children, each with 2 grandchildren. Sidebar opens
// with the root expanded (its children visible) but grandchildren hidden.
// Clicking a chevron flips it.
export const NestedSidebarCollapsed: Story = {
  name: 'Nested — grandchildren collapsed',
  render: () => (
    <SidebarHost
      token="nested-token-bbbb2222"
      initialPath="/share/nested-token-bbbb2222"
      pages={[
        { id: 200, title: 'Handbook', parent_id: null },
        { id: 210, title: 'Engineering', parent_id: 200 },
        { id: 211, title: 'Services', parent_id: 210 },
        { id: 212, title: 'Data flow', parent_id: 210 },
        { id: 220, title: 'Operations', parent_id: 200 },
        { id: 221, title: 'Vendors', parent_id: 220 },
        { id: 222, title: 'Incidents', parent_id: 220 },
        { id: 230, title: 'Design', parent_id: 200 },
        { id: 231, title: 'Brand', parent_id: 230 },
        { id: 232, title: 'Components', parent_id: 230 },
      ]}
    />
  ),
}

// Active grandchild deep in the tree. The active-page effect walks the
// ancestor chain on mount and expands each parent, so the row is visible
// even though localStorage starts empty for this token.
export const NestedSidebarActiveDeep: Story = {
  name: 'Nested — ancestor auto-expand on deep active page',
  render: () => (
    <SidebarHost
      token="active-deep-token-cccc3333"
      initialPath="/share/active-deep-token-cccc3333/p/232"
      pages={[
        { id: 200, title: 'Handbook', parent_id: null },
        { id: 210, title: 'Engineering', parent_id: 200 },
        { id: 211, title: 'Services', parent_id: 210 },
        { id: 212, title: 'Data flow', parent_id: 210 },
        { id: 220, title: 'Operations', parent_id: 200 },
        { id: 221, title: 'Vendors', parent_id: 220 },
        { id: 222, title: 'Incidents', parent_id: 220 },
        { id: 230, title: 'Design', parent_id: 200 },
        { id: 231, title: 'Brand', parent_id: 230 },
        { id: 232, title: 'Components', parent_id: 230 },
      ]}
    />
  ),
}

// 8-level deep chain. Visual indent stops growing at MAX_DEPTH=6 — rows
// deeper than that share the same left padding so the sidebar stays
// readable.
export const DeepNestingDepthCap: Story = {
  name: 'Deep nesting — indent caps at depth 6',
  render: () => (
    <SidebarHost
      token="deep-token-dddd4444"
      initialPath="/share/deep-token-dddd4444/p/308"
      pages={[
        { id: 300, title: 'Level 0 (root)', parent_id: null },
        { id: 301, title: 'Level 1', parent_id: 300 },
        { id: 302, title: 'Level 2', parent_id: 301 },
        { id: 303, title: 'Level 3', parent_id: 302 },
        { id: 304, title: 'Level 4', parent_id: 303 },
        { id: 305, title: 'Level 5', parent_id: 304 },
        { id: 306, title: 'Level 6 (cap)', parent_id: 305 },
        { id: 307, title: 'Level 7 (same indent)', parent_id: 306 },
        { id: 308, title: 'Level 8 (active)', parent_id: 307 },
      ]}
    />
  ),
}
