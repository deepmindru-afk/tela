import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { AccessAuditEntry } from '../types'

// GET /api/orgs/{id}/audit — the access-control history scoped to one org
// (membership, groups, grants, domain maps). Org-admin gated (instance-admins
// pass too). Reuses the AccessAuditEntry shape + AuditRow rendering.
export const orgAuditKeys = {
  all: ['org-audit'] as const,
  list: (orgId: number) => [...orgAuditKeys.all, orgId] as const,
}

export function useOrgAudit(orgId: number | null | undefined) {
  return useQuery({
    queryKey: orgId != null ? orgAuditKeys.list(orgId) : orgAuditKeys.list(-1),
    queryFn: async () => {
      const { entries } = await api<{ entries: AccessAuditEntry[] }>(
        `/api/orgs/${orgId}/audit`,
      )
      return entries
    },
    enabled: orgId != null,
    staleTime: 15_000,
  })
}
