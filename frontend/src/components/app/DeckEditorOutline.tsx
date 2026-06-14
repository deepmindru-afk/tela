import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

interface DeckSlide {
  no: number
  title: string
  layout: string
  note: string
}
interface DeckParse {
  count: number
  slides: DeckSlide[]
  errors?: { row?: number; message: string }[]
}

// Live slide navigator beside the deck markdown editor. Parses the CURRENT
// (unsaved) editor buffer via the real @slidev/parser (POST .../deck/parse) — a
// naive `---` split would break on code fences and frontmatter — so the outline
// always matches what will render. Debounced; keepPreviousData avoids flicker
// while typing. Read-only structure + validation; no render, no Chromium.
export function DeckEditorOutline({
  body,
  pageId,
  className,
}: {
  body: string
  pageId: number
  className?: string
}) {
  const [debounced, setDebounced] = useState(body)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(body), 400)
    return () => clearTimeout(t)
  }, [body])

  const { data, isError } = useQuery({
    queryKey: ['deck-outline-draft', pageId, debounced],
    queryFn: () =>
      api<DeckParse>(`/api/pages/${pageId}/deck/parse`, {
        method: 'POST',
        body: debounced,
        headers: { 'Content-Type': 'text/markdown' },
      }),
    enabled: debounced.trim().length > 0,
    staleTime: Infinity, // same text → same parse
    placeholderData: keepPreviousData,
    retry: false,
  })

  const errors = data?.errors ?? []

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col gap-[var(--space-2)] overflow-y-auto',
        'rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-[var(--space-3)]',
        className,
      )}
      aria-label="Slide outline"
    >
      <div className="flex items-center justify-between text-[var(--text-xs)] uppercase tracking-wide text-[var(--text-muted)]">
        <span>Outline</span>
        <span className="tabular-nums">{data ? `${data.count} slide${data.count === 1 ? '' : 's'}` : ''}</span>
      </div>

      {errors.length ? (
        <div className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-sm)] bg-[var(--accent-warning-soft)] p-[var(--space-2)] text-[var(--text-xs)] text-[var(--accent-warning-fg)]">
          <AlertTriangle width={14} height={14} className="mt-[2px] shrink-0" />
          <span>{errors.map((e) => (e.row != null ? `line ${e.row}: ${e.message}` : e.message)).join('; ')}</span>
        </div>
      ) : null}

      {isError ? (
        <p className="text-[var(--text-xs)] text-[var(--text-muted)]">Outline unavailable.</p>
      ) : !data ? (
        <p className="text-[var(--text-xs)] text-[var(--text-muted)]">Start typing slides…</p>
      ) : (
        <ol className="flex flex-col gap-[1px]">
          {data.slides.map((s) => (
            <li
              key={s.no}
              className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--text-sm)]"
            >
              <span className="w-5 shrink-0 text-right text-[var(--text-xs)] tabular-nums text-[var(--text-muted)]">{s.no}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                {s.title || <span className="text-[var(--text-muted)]">Untitled</span>}
              </span>
              <span className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-3)] px-[var(--space-1)] text-[var(--text-xs)] text-[var(--text-muted)]">
                {s.layout}
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
