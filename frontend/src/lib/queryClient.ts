import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // SWR window. At the old 30s every page revisit within the 5-min gcTime
      // was "stale" and fired a background refetch — so a single sidebar click
      // re-hit 7-10 endpoints over the ~240ms Cloudflare-tunnel floor even
      // though the data was already cached. 2 min makes rapid back-and-forth
      // navigation paint instantly from cache with no network. It's safe
      // because every list/detail query is invalidated by its own mutation
      // (create/update/delete/move) and live page content arrives over the Yjs
      // websocket, not these REST reads.
      staleTime: 120_000,
      // Keep cache entries warm well past the stale window so navigating back
      // after a break still paints instantly, then revalidates.
      gcTime: 1_800_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
