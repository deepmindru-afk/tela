import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Clock, FileClock, Star } from 'lucide-react'
import { useMe } from '../../lib/queries/auth'
import { useRecentChanges } from '../../lib/queries/recent-changes'
import { useFavorites } from '../../lib/queries/favorites'
import { readRecentPages } from '../../lib/recentPages'
import { localDateFromSqlite } from '../../lib/relativeTime'
import { cn } from '../../lib/utils'

// Home dashboard — the landing surface we enrich over time. Today it gathers
// three feeds: recent changes (what the team touched), favorites (what you
// starred), and recently visited (where you've been). Future widgets
// (notifications, drafts, getting-started) slot in here.
export function HomeRoute() {
  const me = useMe()
  const recent = useRecentChanges()
  const favorites = useFavorites()
  const visited = useMemo(() => readRecentPages(), [])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[64rem] w-full mx-auto p-[var(--space-7)] flex flex-col gap-[var(--space-6)]">
        <header className="flex flex-col gap-[var(--space-1)]">
          <h1 className="m-0 font-[family-name:var(--font-sans)] text-[length:var(--text-2xl)] leading-[var(--leading-tight)] text-[var(--text-primary)]">
            {me.data?.username ? `Welcome back, ${me.data.username}` : 'Home'}
          </h1>
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            What changed, what you starred, and where you’ve been.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-5)]">
          {/* Recent changes — the main column. */}
          <Widget
            className="lg:col-span-2"
            icon={FileClock}
            title="Recent changes"
            loading={recent.isLoading}
            error={recent.isError}
            empty={!recent.data || recent.data.length === 0}
            emptyText="No edits yet. Create or edit a page and it shows up here."
          >
            {recent.data?.map((c) => (
              <PageRow
                key={`change-${c.page_id}`}
                spaceId={c.space_id}
                pageId={c.page_id}
                title={c.title}
                meta={
                  <>
                    {c.space_name}
                    {' · '}
                    {c.author_username ? `${c.author_username} · ` : ''}
                    {localDateFromSqlite(c.updated_at)}
                  </>
                }
              />
            ))}
          </Widget>

          <div className="flex flex-col gap-[var(--space-5)]">
            {/* Favorites. */}
            <Widget
              icon={Star}
              title="Favorites"
              loading={favorites.isLoading}
              error={favorites.isError}
              empty={!favorites.data || favorites.data.length === 0}
              emptyText="Star a page to pin it here."
            >
              {favorites.data?.map((f) => (
                <PageRow
                  key={`fav-${f.page_id}`}
                  spaceId={f.space_id}
                  pageId={f.page_id}
                  title={f.title}
                  meta={f.space_name}
                />
              ))}
            </Widget>

            {/* Recently visited — client-side, no backend. */}
            <Widget
              icon={Clock}
              title="Recently visited"
              empty={visited.length === 0}
              emptyText="Pages you open will appear here."
            >
              {visited.map((v) => (
                <PageRow
                  key={`visited-${v.pageId}`}
                  spaceId={v.spaceId}
                  pageId={v.pageId}
                  title={v.title}
                />
              ))}
            </Widget>
          </div>
        </div>
      </div>
    </div>
  )
}

function Widget({
  icon: Icon,
  title,
  loading,
  error,
  empty,
  emptyText,
  className,
  children,
}: {
  icon: typeof Star
  title: string
  loading?: boolean
  error?: boolean
  empty?: boolean
  emptyText: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-[var(--space-3)] p-[var(--space-5)]',
        'rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)]',
        className,
      )}
    >
      <h2 className="m-0 flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] font-semibold text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
        <Icon width={16} height={16} aria-hidden className="text-[var(--text-muted)]" />
        {title}
      </h2>
      {loading ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">Loading…</p>
      ) : error ? (
        <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Couldn’t load.
        </p>
      ) : empty ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">{emptyText}</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-[1px]">{children}</ul>
      )}
    </section>
  )
}

function PageRow({
  spaceId,
  pageId,
  title,
  meta,
}: {
  spaceId: number
  pageId: number
  title: string
  meta?: React.ReactNode
}) {
  return (
    <li>
      <Link
        to="/spaces/$spaceId/pages/$pageId/{-$slug}"
        params={{ spaceId, pageId, slug: undefined }}
        className={cn(
          'flex flex-col gap-[1px] px-[var(--space-3)] py-[var(--space-2)]',
          'rounded-[var(--radius-sm)] no-underline',
          'hover:bg-[var(--surface-2)]',
        )}
      >
        <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)]">
          {title || 'Untitled'}
        </span>
        {meta ? (
          <span className="truncate text-[length:var(--text-xs)] text-[var(--text-muted)]">
            {meta}
          </span>
        ) : null}
      </Link>
    </li>
  )
}
