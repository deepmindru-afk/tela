import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

// List-row shape returned by GET /api/pages/{id}/revisions. Mirrors the
// Go DTO in backend/internal/api/page_revisions.go — `body` is omitted
// from list payloads (cached `byte_size` is enough for the row).
export interface PageRevision {
  id: number
  page_id: number
  title: string
  author_id: number | null
  author_username: string | null
  source: string
  byte_size: number
  created_at: string
}

// Single-revision shape returned by GET /api/pages/{id}/revisions/{rev_id}.
// Same as the list row plus `body` (needed for the future diff + soft-draft).
export interface PageRevisionFull extends PageRevision {
  body: string
}

export const revisionKeys = {
  all: ['revisions'] as const,
  page: (pageId: number) => [...revisionKeys.all, 'page', pageId] as const,
  detail: (pageId: number, revId: number) =>
    [...revisionKeys.page(pageId), 'detail', revId] as const,
}

interface UseRevisionsArgs {
  pageId: number | null | undefined
  // Skip the query entirely (used to gate viewer-role users out — they get
  // 403 from the backend if we ask, same pattern as `useComments`).
  enabled?: boolean
}

// First page only (limit=50 server-side default). Callers wanting pagination
// drive subsequent pages imperatively via `queryClient.fetchQuery` against
// a cursor-scoped sub-key (see PageHistoryView.handleLoadMore) — kept out
// of the hook layer so the load-more flow stays effect-free.
export function useRevisions({ pageId, enabled = true }: UseRevisionsArgs) {
  return useQuery({
    queryKey:
      pageId != null ? revisionKeys.page(pageId) : revisionKeys.page(-1),
    queryFn: async () => {
      const { revisions } = await api<{ revisions: PageRevision[] }>(
        `/api/pages/${pageId}/revisions`,
      )
      return revisions
    },
    enabled: enabled && pageId != null,
  })
}

interface UseRevisionArgs {
  pageId: number | null | undefined
  revId: number | null | undefined
  enabled?: boolean
}

// Revisions are immutable once written, so we hold the per-revision
// detail forever (staleTime: Infinity). The diff viewer in M9.2 / #78
// reads from this cache; the soft-draft seeder in M9.3 / #79 will too.
export function useRevision({ pageId, revId, enabled = true }: UseRevisionArgs) {
  return useQuery({
    queryKey:
      pageId != null && revId != null
        ? revisionKeys.detail(pageId, revId)
        : revisionKeys.detail(-1, -1),
    queryFn: async () => {
      const { revision } = await api<{ revision: PageRevisionFull }>(
        `/api/pages/${pageId}/revisions/${revId}`,
      )
      return revision
    },
    enabled: enabled && pageId != null && revId != null,
    staleTime: Infinity,
  })
}
