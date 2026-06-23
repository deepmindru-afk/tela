import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

// Follow/subscribe to a page or space → opts into its change notifications.
// Backed by /api/{pages|spaces}/{id}/subscription.

export type SubscribableKind = 'page' | 'space'

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  one: (kind: SubscribableKind, id: number) => [...subscriptionKeys.all, kind, id] as const,
  list: ['subscriptions', 'list'] as const,
}

function subPath(kind: SubscribableKind, id: number) {
  return `/api/${kind === 'page' ? 'pages' : 'spaces'}/${id}/subscription`
}

export function useSubscription(kind: SubscribableKind, id: number | null | undefined) {
  return useQuery({
    queryKey: id != null ? subscriptionKeys.one(kind, id) : subscriptionKeys.one(kind, -1),
    queryFn: async () => {
      const { subscribed } = await api<{ subscribed: boolean }>(subPath(kind, id as number))
      return subscribed
    },
    enabled: id != null,
  })
}

export function useToggleSubscription(kind: SubscribableKind, id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (subscribed: boolean) => {
      await api<void>(subPath(kind, id), { method: subscribed ? 'DELETE' : 'POST' })
      return !subscribed
    },
    onSuccess: (nowSubscribed) => {
      qc.setQueryData(subscriptionKeys.one(kind, id), nowSubscribed)
      qc.invalidateQueries({ queryKey: subscriptionKeys.list })
    },
  })
}

// The "what am I following" list (Settings → Following).
export type Subscription = {
  kind: SubscribableKind
  id: number
  title: string
  space_id?: number
  created_at: string
}

export function useSubscriptions() {
  return useQuery({
    queryKey: subscriptionKeys.list,
    queryFn: async () => {
      const { subscriptions } = await api<{ subscriptions: Subscription[] }>(
        '/api/users/me/subscriptions',
      )
      return subscriptions
    },
  })
}

// Autowatch: auto-follow pages you create, edit, or comment on.
export function useAutowatch() {
  return useQuery({
    queryKey: ['autowatch'],
    queryFn: async () => {
      const { autowatch } = await api<{ autowatch: boolean }>('/api/users/me/autowatch')
      return autowatch
    },
  })
}

export function useSetAutowatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (autowatch: boolean) => {
      await api<void>('/api/users/me/autowatch', {
        method: 'PUT',
        body: JSON.stringify({ autowatch }),
      })
      return autowatch
    },
    onSuccess: (v) => qc.setQueryData(['autowatch'], v),
  })
}

// Unfollow from the list view: DELETE, then refresh the list + the item's toggle.
export function useUnfollow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ kind, id }: { kind: SubscribableKind; id: number }) => {
      await api<void>(subPath(kind, id), { method: 'DELETE' })
      return { kind, id }
    },
    onSuccess: ({ kind, id }) => {
      qc.setQueryData(subscriptionKeys.one(kind, id), false)
      qc.invalidateQueries({ queryKey: subscriptionKeys.list })
    },
  })
}
