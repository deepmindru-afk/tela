import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

// Per-user pinned spaces. Feeds the sidebar "Pinned" group: the list is just the
// set of pinned space ids (most-recent pin first) — the sidebar already holds the
// full Space objects from useSpaces() and partitions them by this set. Backed by
// /api/users/me/pinned-spaces + /api/spaces/{id}/pin (see backend pinned_spaces.go).

interface PinnedSpaceRow {
  space_id: number
  created_at: string
}

export const pinnedSpaceKeys = {
  all: ['pinned-spaces'] as const,
  list: () => [...pinnedSpaceKeys.all, 'list'] as const,
}

// Returns pinned space ids ordered most-recently-pinned first.
export function usePinnedSpaces() {
  return useQuery({
    queryKey: pinnedSpaceKeys.list(),
    queryFn: async () => {
      const { pinned_spaces } = await api<{ pinned_spaces: PinnedSpaceRow[] }>(
        '/api/users/me/pinned-spaces',
      )
      return pinned_spaces.map((p) => p.space_id)
    },
    staleTime: 15_000,
  })
}

export function useTogglePinSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      spaceId,
      isPinned,
    }: {
      spaceId: number
      isPinned: boolean
    }) => {
      await api<void>(`/api/spaces/${spaceId}/pin`, {
        method: isPinned ? 'DELETE' : 'PUT',
      })
      return { spaceId, nowPinned: !isPinned }
    },
    // Optimistic: pinning prepends (most-recent first), unpinning drops it.
    onMutate: async ({ spaceId, isPinned }) => {
      await qc.cancelQueries({ queryKey: pinnedSpaceKeys.list() })
      const prev = qc.getQueryData<number[]>(pinnedSpaceKeys.list())
      qc.setQueryData<number[]>(pinnedSpaceKeys.list(), (cur = []) =>
        isPinned ? cur.filter((id) => id !== spaceId) : [spaceId, ...cur],
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(pinnedSpaceKeys.list(), ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: pinnedSpaceKeys.list() })
    },
  })
}
