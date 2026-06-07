import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

// Per-user page favorites. The list feeds the sidebar Favorites section and the
// home dashboard; the per-page status drives the header star toggle. Backed by
// /api/users/me/favorites + /api/pages/{id}/favorite (see backend favorites.go).

export interface FavoriteItem {
  page_id: number
  title: string
  space_id: number
  space_name: string
  created_at: string
}

export const favoriteKeys = {
  all: ['favorites'] as const,
  list: () => [...favoriteKeys.all, 'list'] as const,
  status: (pageId: number) => [...favoriteKeys.all, 'status', pageId] as const,
}

export function useFavorites() {
  return useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: async () => {
      const { favorites } = await api<{ favorites: FavoriteItem[] }>(
        '/api/users/me/favorites',
      )
      return favorites
    },
    staleTime: 15_000,
  })
}

export function useFavoriteStatus(pageId: number | null | undefined) {
  return useQuery({
    queryKey: pageId != null ? favoriteKeys.status(pageId) : favoriteKeys.status(-1),
    queryFn: async () => {
      const { is_favorited } = await api<{ is_favorited: boolean }>(
        `/api/pages/${pageId}/favorite`,
      )
      return is_favorited
    },
    enabled: pageId != null,
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      pageId,
      isFavorited,
    }: {
      pageId: number
      isFavorited: boolean
    }) => {
      if (isFavorited) {
        await api<void>(`/api/pages/${pageId}/favorite`, { method: 'DELETE' })
      } else {
        await api<{ is_favorited: boolean }>(`/api/pages/${pageId}/favorite`, {
          method: 'POST',
        })
      }
      return { pageId, nowFavorited: !isFavorited }
    },
    onSuccess: ({ pageId, nowFavorited }) => {
      qc.setQueryData(favoriteKeys.status(pageId), nowFavorited)
      void qc.invalidateQueries({ queryKey: favoriteKeys.list() })
    },
  })
}
