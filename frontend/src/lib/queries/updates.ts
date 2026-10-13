import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { authKeys } from './auth'

// Self-host update check (backend update_check.go): the instance asks
// updates.telawiki.com for the latest tela release once a day. Instance-admin only.
export interface UpdateStatus {
  // false on the managed cloud or a dev build: there is nothing to show.
  applies: boolean
  enabled: boolean
  // TELA_UPDATE_CHECK=0 turned it off; the toggle can't turn it back on.
  env_locked: boolean
  current: string
  latest?: string
  release_url?: string
  published_at?: string
  // 'YYYY-MM-DD HH:MM:SS' UTC
  checked_at?: string
  error?: string
  update_available: boolean
}

export const updateKeys = { status: ['updates', 'status'] as const }

export function useUpdateStatus() {
  return useQuery({
    queryKey: updateKeys.status,
    queryFn: () => api<UpdateStatus>('/api/admin/updates'),
    staleTime: 60_000,
  })
}

// POST /api/admin/updates/check: check now. The account-menu notice rides /me,
// so refresh that too.
export function useCheckForUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<UpdateStatus>('/api/admin/updates/check', { method: 'POST' }),
    onSuccess: (st) => {
      qc.setQueryData(updateKeys.status, st)
      void qc.invalidateQueries({ queryKey: authKeys.me() })
    },
  })
}
