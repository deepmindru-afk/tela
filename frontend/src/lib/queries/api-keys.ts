import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { ApiKeyRow, ApiKeyScope } from '../types'

// M16.A.3 — manage personal access tokens (`tela_pat_xxx`) from the Settings
// → API Keys tab. The CRUD surface is instance-admin only (the backend's
// requireAPIKeyAdmin gates it), so this hook never mounts for non-admins.
//
// The full raw key value is returned ONCE on the POST response — list/get
// scrub it. The Settings tab pipes the create payload through a show-once
// Dialog so the operator can copy it before it's gone for good.

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  list: () => [...apiKeyKeys.all, 'list'] as const,
}

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeyKeys.list(),
    queryFn: async () => {
      const { api_keys } = await api<{ api_keys: ApiKeyRow[] }>(
        '/api/api_keys',
      )
      return api_keys
    },
    staleTime: 30_000,
  })
}

export interface CreateApiKeyInput {
  name: string
  scope: ApiKeyScope
  // Omitted → all spaces. Numeric id → restrict to that single space.
  space_id?: number | null
  // SQLite wire format `YYYY-MM-DD HH:MM:SS`. Omitted → never expires.
  expires_at?: string | null
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      const body: Record<string, unknown> = {
        name: input.name,
        scope: input.scope,
      }
      if (input.space_id != null) body.space_id = input.space_id
      if (input.expires_at && input.expires_at.length > 0) {
        body.expires_at = input.expires_at
      }
      const { api_key } = await api<{ api_key: ApiKeyRow }>('/api/api_keys', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return api_key
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: apiKeyKeys.list() })
    },
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api<void>(`/api/api_keys/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: apiKeyKeys.list() })
    },
  })
}
