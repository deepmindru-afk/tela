import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { OrgBranding } from '../types'

// An org's white-label branding overrides — the logo + accent that theme its
// custom-domain login screen and (via host-context) the whole UI on that
// domain. Org-admin gated. Mirrors org-login-settings.ts.

export const orgBrandingKeys = {
  all: ['org-branding'] as const,
  detail: (orgId: number) => [...orgBrandingKeys.all, orgId] as const,
}

// GET /api/orgs/{id}/branding.
export function useOrgBranding(orgId: number) {
  return useQuery({
    queryKey: orgBrandingKeys.detail(orgId),
    queryFn: async () => api<OrgBranding>(`/api/orgs/${orgId}/branding`),
    staleTime: 30_000,
  })
}

// PUT /api/orgs/{id}/branding — echoes back the saved branding. 400 bad_request
// when logo_url isn't https:// or accent isn't a hex/oklch()/rgb() color.
// Empty strings clear the respective override.
export function usePutOrgBranding(orgId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: OrgBranding) =>
      api<OrgBranding>(`/api/orgs/${orgId}/branding`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: (saved) => {
      qc.setQueryData(orgBrandingKeys.detail(orgId), saved)
    },
  })
}
