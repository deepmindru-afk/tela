import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

// The weekly-digest opt-in, backed by GET/PATCH /api/me/digest. Frequency is
// 'off' | 'weekly'. This is what the digest email's "Change frequency" link
// points at (Settings → Notifications).
const digestKey = ['me', 'digest'] as const

export type DigestFrequency = 'off' | 'weekly'

export function useDigestPref() {
  return useQuery({
    queryKey: digestKey,
    queryFn: () => api<{ frequency: DigestFrequency }>('/api/me/digest'),
  })
}

export function useSetDigestPref() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (frequency: DigestFrequency) =>
      api<{ frequency: DigestFrequency }>('/api/me/digest', {
        method: 'PATCH',
        body: JSON.stringify({ frequency }),
      }),
    onSuccess: (data) => qc.setQueryData(digestKey, data),
  })
}
