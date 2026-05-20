import { useCallback, useState } from 'react'

// Per-share-token, localStorage-backed set of expanded page-tree node IDs.
// Storage shape: `tela.share-expanded.<token>` -> JSON array of numeric ids.
// Mirrors lib/useExpandedNodes (keyed on spaceId number), but keyed on the
// share token string so independent shares keep independent expand state.
const KEY = (token: string) => `tela.share-expanded.${token}`

function read(token: string): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(KEY(token))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is number => typeof v === 'number'))
  } catch {
    return new Set()
  }
}

function write(token: string, ids: Set<number>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY(token), JSON.stringify([...ids]))
  } catch {
    // Ignore quota / privacy-mode failures — collapsing on reload is acceptable.
  }
}

// Seed the initial expanded set with the share's root id so the root is
// expanded by default even if localStorage is empty. If the root id is not
// known yet (the tree query hasn't resolved), start with whatever is
// persisted; the "reset state when prop changes" pattern below picks the
// root up once it lands.
function initial(token: string, rootId: number | null): Set<number> {
  const persisted = read(token)
  if (rootId != null) persisted.add(rootId)
  return persisted
}

export function useShareExpanded(token: string, rootId: number | null) {
  // "Reset state when a prop changes" — React's preferred shape over a
  // useEffect that calls setState. Mirrors useExpandedNodes' pattern.
  // https://react.dev/learn/you-might-not-need-an-effect
  const [prevKey, setPrevKey] = useState<string>(`${token}:${rootId ?? ''}`)
  const [expanded, setExpanded] = useState<Set<number>>(() => initial(token, rootId))
  const currentKey = `${token}:${rootId ?? ''}`
  if (prevKey !== currentKey) {
    setPrevKey(currentKey)
    setExpanded(initial(token, rootId))
  }

  const toggle = useCallback(
    (id: number) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        write(token, next)
        return next
      })
    },
    [token],
  )

  const expand = useCallback(
    (id: number) => {
      setExpanded((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        write(token, next)
        return next
      })
    },
    [token],
  )

  return { expanded, toggle, expand }
}
