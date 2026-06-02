import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Printer, Type, X } from 'lucide-react'
import type { EditorView } from '@milkdown/kit/prose/view'
import { ApiError } from '../../lib/api'
import { useAllPages, usePage } from '../../lib/queries/pages'
import { relativeTimeFromSqlite } from '../../lib/relativeTime'
import {
  getTheme,
  setTheme,
  subscribeToTheme,
  THEMES,
  type ThemeName,
} from '../../lib/theme'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle'

// Lazy — same reasoning as PageView/ShareReader: the Milkdown grammar/Yjs blob
// is the app's largest dep and ships as its own chunk; the reader should not
// drag it into the main entry.
const MilkdownEditor = lazy(() =>
  import('./milkdown-editor').then((m) => ({ default: m.MilkdownEditor })),
)

// Inlined (mirrors ShareReader) so the wikilink-decoration module isn't pulled
// in as a shared dep of a second lazy root.
function parseWikilinkPageId(href: string): number | null {
  const prefix = 'tela://page/'
  if (!href.startsWith(prefix)) return null
  const tail = href.slice(prefix.length)
  if (!/^\d+$/.test(tail)) return null
  return Number(tail)
}

type ReaderSize = 's' | 'm' | 'l'
type ReaderFont = 'sans' | 'serif'
const SIZE_KEY = 'tela:reader:size'
const FONT_KEY = 'tela:reader:font'
const WORDS_PER_MIN = 220

function readPref<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  try {
    const v = localStorage.getItem(key)
    return v && (valid as readonly string[]).includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private-mode / quota — preference just won't persist this session.
  }
}

// Rough word count for the reading-time estimate. Strips the loudest markdown
// noise so fenced code / link URLs don't inflate the count — good enough for an
// at-a-glance "N min read", not a parser.
function readingMinutes(body: string): number {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`-]/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MIN))
}

interface TocEntry {
  id: string
  text: string
  level: number
}

interface PageReaderProps {
  spaceId: number
  pageId: number
}

export function PageReader({ spaceId, pageId }: PageReaderProps) {
  const page = usePage(pageId)

  if (page.isError) {
    const status = page.error instanceof ApiError ? page.error.status : null
    return <ReaderMessage spaceId={spaceId} notFound={status === 404} />
  }
  if (page.isLoading || !page.data) return <ReaderLoading />
  if (page.data.space_id !== spaceId) {
    return <ReaderMessage spaceId={spaceId} notFound />
  }

  return (
    <ReaderShell
      key={page.data.id}
      spaceId={spaceId}
      pageId={page.data.id}
      title={page.data.title}
      body={page.data.body}
      updatedAt={page.data.updated_at}
    />
  )
}

interface ReaderShellProps {
  spaceId: number
  pageId: number
  title: string
  body: string
  updatedAt: string
}

function ReaderShell({
  spaceId,
  pageId,
  title,
  body,
  updatedAt,
}: ReaderShellProps) {
  const navigate = useNavigate()
  const editorRoute = {
    to: '/spaces/$spaceId/pages/$pageId' as const,
    params: { spaceId, pageId },
  }

  // Preferences — text size + typeface, persisted.
  const [size, setSize] = useState<ReaderSize>(() =>
    readPref<ReaderSize>(SIZE_KEY, 'm', ['s', 'm', 'l']),
  )
  const [font, setFont] = useState<ReaderFont>(() =>
    readPref<ReaderFont>(FONT_KEY, 'sans', ['sans', 'serif']),
  )
  const [theme, setThemeState] = useState<ThemeName>(() => getTheme())
  useEffect(() => subscribeToTheme(setThemeState), [])

  // Alive page ids power broken-wikilink rendering; the full list also resolves
  // a clicked wikilink's target space so navigation stays inside reading mode.
  const allPages = useAllPages()
  const aliveIds = useMemo<Set<number> | null>(
    () => (allPages.data ? new Set(allPages.data.map((p) => p.id)) : null),
    [allPages.data],
  )
  const spaceByPageId = useMemo(() => {
    const m = new Map<number, number>()
    for (const p of allPages.data ?? []) m.set(p.id, p.space_id)
    return m
  }, [allPages.data])

  const minutes = useMemo(() => readingMinutes(body), [body])

  // Document title while in the reader.
  useEffect(() => {
    const prev = document.title
    document.title = `${title || 'Untitled'} — tela`
    return () => {
      document.title = prev
    }
  }, [title])

  // Esc exits back to the editor.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        void navigate(editorRoute)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, spaceId, pageId])

  // --- TOC + scroll-spy + progress ---------------------------------------
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const progressRef = useRef<HTMLDivElement | null>(null)
  const topbarRef = useRef<HTMLElement | null>(null)
  const headingsRef = useRef<HTMLElement[]>([])
  const [toc, setToc] = useState<TocEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeRef = useRef<string | null>(null)

  // Build the TOC from the rendered heading DOM once the editor view is ready.
  // Markdown→DOM heading order is stable, so reading straight off view.dom keeps
  // the TOC guaranteed in-sync with what's on screen.
  const handleViewReady = useCallback((view: EditorView | null) => {
    if (!view) return
    requestAnimationFrame(() => {
      const els = Array.from(
        view.dom.querySelectorAll('h1, h2, h3'),
      ) as HTMLElement[]
      const entries: TocEntry[] = []
      els.forEach((el, i) => {
        const text = (el.textContent ?? '').trim()
        if (!text) return
        if (!el.id) el.id = `reader-h-${i}`
        el.classList.add('reader-heading')
        entries.push({ id: el.id, text, level: Number(el.tagName[1]) })
      })
      headingsRef.current = els.filter((el) => el.id && el.textContent?.trim())
      setToc(entries)
    })
  }, [])

  useEffect(() => {
    const sc = scrollRef.current
    if (!sc) return
    let raf = 0
    const update = () => {
      raf = 0
      const max = sc.scrollHeight - sc.clientHeight
      const p = max > 0 ? sc.scrollTop / max : 0
      if (progressRef.current) {
        progressRef.current.style.setProperty('--reader-progress', String(p))
      }
      if (topbarRef.current) {
        topbarRef.current.dataset.scrolled = sc.scrollTop > 4 ? 'true' : 'false'
      }
      // Active heading = last one whose top has crossed a band below the bar.
      const threshold = sc.getBoundingClientRect().top + 96
      let next: string | null = headingsRef.current[0]?.id ?? null
      for (const el of headingsRef.current) {
        if (el.getBoundingClientRect().top <= threshold) next = el.id
        else break
      }
      if (next !== activeRef.current) {
        activeRef.current = next
        setActiveId(next)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    sc.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      sc.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [toc])

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [])

  // Wikilink navigation — keep clicks inside the reader. Capture phase so we run
  // before the editor's own broken-wikilink listener (which would otherwise open
  // the new-page dialog); we preventDefault every tela:// link and navigate only
  // when the target's space is resolvable.
  const articleRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = articleRef.current
    if (!el) return
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      if (!anchor) return
      const id = parseWikilinkPageId(anchor.getAttribute('href') ?? '')
      if (id == null) return
      e.preventDefault()
      e.stopPropagation()
      const sp = spaceByPageId.get(id)
      if (sp == null) return
      void navigate({
        to: '/read/$spaceId/$pageId',
        params: { spaceId: sp, pageId: id },
      })
    }
    el.addEventListener('click', onClick, true)
    return () => el.removeEventListener('click', onClick, true)
  }, [navigate, spaceByPageId])

  return (
    <div className="tela-reader" data-reading-size={size} data-reading-font={font}>
      <div ref={progressRef} className="reader-progress" aria-hidden />

      <header ref={topbarRef} className="reader-topbar" data-scrolled="false">
        <div className="reader-topbar-left">
          <Button
            asChild
            variant="ghost"
            size="sm"
            aria-label="Close reading mode"
            className="h-[var(--space-8)] w-[var(--space-8)] p-0"
          >
            <Link {...editorRoute}>
              <X width={16} height={16} />
            </Link>
          </Button>
          <span className="reader-topbar-title">{title || 'Untitled'}</span>
        </div>

        <div className="reader-topbar-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Reading display options"
                className="h-[var(--space-8)] px-[var(--space-3)]"
              >
                <Type width={16} height={16} />
                <span>Display</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="reader-prefs">
                <div className="reader-prefs-group">
                  <span className="reader-prefs-label">Text size</span>
                  <ToggleGroup
                    type="single"
                    value={size}
                    onValueChange={(v) => {
                      if (!v) return
                      setSize(v as ReaderSize)
                      writePref(SIZE_KEY, v)
                    }}
                    aria-label="Text size"
                  >
                    <ToggleGroupItem value="s">Small</ToggleGroupItem>
                    <ToggleGroupItem value="m">Medium</ToggleGroupItem>
                    <ToggleGroupItem value="l">Large</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="reader-prefs-group">
                  <span className="reader-prefs-label">Typeface</span>
                  <ToggleGroup
                    type="single"
                    value={font}
                    onValueChange={(v) => {
                      if (!v) return
                      setFont(v as ReaderFont)
                      writePref(FONT_KEY, v)
                    }}
                    aria-label="Typeface"
                  >
                    <ToggleGroupItem value="sans">Sans</ToggleGroupItem>
                    <ToggleGroupItem value="serif">Serif</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="reader-prefs-group">
                  <span className="reader-prefs-label">Theme</span>
                  <ToggleGroup
                    type="single"
                    value={theme}
                    onValueChange={(v) => {
                      if (!v) return
                      setTheme(v as ThemeName)
                      setThemeState(v as ThemeName)
                    }}
                    aria-label="Theme"
                  >
                    {THEMES.map((t) => (
                      <ToggleGroupItem key={t} value={t} className="capitalize">
                        {t}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Print or save as PDF"
            onClick={() => window.print()}
            className="h-[var(--space-8)] px-[var(--space-3)]"
          >
            <Printer width={16} height={16} />
            <span>Print</span>
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="reader-scroll">
        <div className="reader-grid">
          {toc.length > 1 ? (
            <nav className="reader-toc" aria-label="On this page">
              <p className="reader-toc-label">On this page</p>
              <ul className="reader-toc-list">
                {toc.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="reader-toc-link"
                      data-level={entry.level}
                      data-active={activeId === entry.id}
                      onClick={() => jumpTo(entry.id)}
                    >
                      {entry.text}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            // Keep the grid's first column present so the article stays centered
            // on wide viewports even when there's no TOC.
            <div className="reader-toc" aria-hidden />
          )}

          <article className="reader-article" ref={articleRef}>
            <h1 className="reader-title">{title || 'Untitled'}</h1>
            <div className="reader-meta">
              <span>{minutes} min read</span>
              <span className="reader-meta-dot" aria-hidden />
              <span>Updated {relativeTimeFromSqlite(updatedAt)}</span>
            </div>
            <Suspense fallback={<ReaderBodyFallback />}>
              <MilkdownEditor
                key={`read-${pageId}`}
                defaultValue={body}
                onChange={noop}
                ariaLabel="Page body"
                aliveWikilinkIds={aliveIds}
                collabPageId={null}
                readOnly
                wikilinkMode="edit"
                pageId={pageId}
                onViewReady={handleViewReady}
              />
            </Suspense>
          </article>
        </div>
      </div>
    </div>
  )
}

function ReaderBodyFallback() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading page"
      className={cn(
        'min-h-[calc(var(--space-8)*8)]',
        'rounded-[var(--radius-sm)]',
        'bg-[var(--surface-2)]',
      )}
    />
  )
}

function ReaderLoading() {
  return (
    <div className="tela-reader">
      <div className="reader-scroll">
        <div className="reader-grid">
          <div className="reader-toc" aria-hidden />
          <div className="reader-article flex flex-col gap-[var(--space-4)] pt-[var(--space-8)]">
            <div className="h-[calc(var(--space-8)+var(--space-3))] w-2/3 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
            <div className="h-[calc(var(--space-8)*4)] rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ReaderMessage({
  spaceId,
  notFound,
}: {
  spaceId: number
  notFound: boolean
}) {
  return (
    <div className="tela-reader items-center justify-center">
      <div className="flex flex-col items-center gap-[var(--space-3)] text-center max-w-[28rem] p-[var(--space-7)]">
        <h2 className="m-0 text-[length:var(--text-xl)] leading-[var(--leading-tight)] font-[family-name:var(--font-sans)] text-[var(--text-primary)]">
          {notFound ? 'Page not found' : "Couldn't load this page"}
        </h2>
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          {notFound
            ? 'The page may have been deleted or moved to another space.'
            : 'Something went wrong loading this page for reading.'}
        </p>
        <Button asChild variant="secondary">
          <Link to="/spaces/$spaceId" params={{ spaceId }}>
            Back to space
          </Link>
        </Button>
      </div>
    </div>
  )
}

function noop() {
  // Read-only — onChange is required by MilkdownEditor's typing but never
  // meaningfully fires (the editable predicate is gated by readOnly).
}
