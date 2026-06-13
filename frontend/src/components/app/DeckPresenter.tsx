import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Download, Maximize, Pencil, X } from 'lucide-react'
import { api } from '../../lib/api'
import { Button } from '../ui/button'

interface DeckManifest {
  id: string
  count: number
  theme: string
  slides: string[]
}

// Full-screen Present for a deck page. The deck's Slidev markdown is rendered to
// per-slide PNGs by the backend (/api/pages/{id}/deck → the deck sidecar); this
// is just a simple image carousel over them. No Slidev runtime in the browser.
export function DeckPresenter({
  spaceId,
  pageId,
}: {
  spaceId: number
  pageId: number
}) {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<DeckManifest | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [i, setI] = useState(0)

  useEffect(() => {
    let alive = true
    setData(null)
    setErr(null)
    api<DeckManifest>(`/api/pages/${pageId}/deck`)
      .then((m) => alive && setData(m))
      .catch((e) => alive && setErr(e?.message || 'Failed to render deck'))
    return () => {
      alive = false
    }
  }, [pageId])

  const n = data?.count ?? 0
  const go = useCallback((d: number) => setI((p) => Math.max(0, Math.min(n - 1, p + d))), [n])
  const close = useCallback(() => {
    void navigate({
      to: '/spaces/$spaceId/pages/$pageId/{-$slug}',
      params: { spaceId, pageId, slug: undefined },
      search: (p) => ({ ...p, view: undefined }),
    })
  }, [navigate, spaceId, pageId])
  const edit = useCallback(() => {
    void navigate({
      to: '/spaces/$spaceId/pages/$pageId/{-$slug}',
      params: { spaceId, pageId, slug: undefined },
      search: (p) => ({ ...p, view: undefined, edit: true }),
    })
  }, [navigate, spaceId, pageId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Escape') {
        close()
      } else if (e.key === 'f' || e.key === 'F') {
        rootRef.current?.requestFullscreen?.().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, close])

  return (
    <div ref={rootRef} className="flex h-full w-full flex-col bg-[var(--surface-3)]">
      <div className="grid min-h-0 flex-1 place-items-center p-[var(--space-5)]">
        {err ? (
          <div className="text-center text-[var(--text-muted)]">
            <p>Couldn't render this deck.</p>
            <p className="mt-[var(--space-2)] text-[var(--text-sm)]">{err}</p>
          </div>
        ) : !data ? (
          <p className="text-[var(--text-muted)]">Rendering deck…</p>
        ) : (
          <img
            src={data.slides[i]}
            alt={`Slide ${i + 1} of ${n}`}
            className="max-h-full max-w-full rounded-[var(--radius-md)] object-contain shadow-2xl"
          />
        )}
      </div>
      <div className="flex items-center justify-center gap-[var(--space-2)] border-t border-[var(--border-subtle)] bg-[var(--surface-2)] p-[var(--space-3)]">
        <Button variant="ghost" size="sm" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous slide">
          <ChevronLeft width={18} height={18} />
        </Button>
        <span className="min-w-[3.5rem] text-center text-[var(--text-sm)] tabular-nums text-[var(--text-muted)]">
          {n ? i + 1 : 0} / {n}
        </span>
        <Button variant="ghost" size="sm" onClick={() => go(1)} disabled={i >= n - 1} aria-label="Next slide">
          <ChevronRight width={18} height={18} />
        </Button>
        <span className="mx-[var(--space-2)] h-4 w-px bg-[var(--border-subtle)]" />
        <Button variant="ghost" size="sm" onClick={() => rootRef.current?.requestFullscreen?.().catch(() => {})} aria-label="Fullscreen">
          <Maximize width={16} height={16} />
        </Button>
        <Button variant="ghost" size="sm" onClick={edit} aria-label="Edit deck">
          <Pencil width={16} height={16} />
        </Button>
        <a href={`/api/pages/${pageId}/deck.pdf`} target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm" aria-label="Download PDF">
            <Download width={16} height={16} />
          </Button>
        </a>
        <Button variant="ghost" size="sm" onClick={close} aria-label="Close presentation">
          <X width={16} height={16} />
        </Button>
      </div>
    </div>
  )
}
