import { Link } from '@tanstack/react-router'
import { FileText, Folder, X } from 'lucide-react'
import { useSubscriptions, useUnfollow, type Subscription } from '../../lib/queries/subscriptions'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

// Settings → Following: everything you watch (pages + spaces), with one-click
// unfollow. The companion to the per-page/space bell — a single place to prune
// what reaches your inbox. Backed by GET /api/users/me/subscriptions.
export function SettingsFollowingTab() {
  const subs = useSubscriptions()
  const unfollow = useUnfollow()

  return (
    <section aria-labelledby="settings-following" className="flex flex-col gap-[var(--space-4)]">
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
        Pages and spaces you follow. You’re notified of changes to these (and new
        pages in followed spaces). Use the bell in any page or space header to
        follow more.
      </p>

      {subs.isLoading ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">Loading…</p>
      ) : subs.isError ? (
        <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Couldn’t load what you’re following.
        </p>
      ) : !subs.data || subs.data.length === 0 ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          You’re not following anything yet.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-0 overflow-hidden">
          {subs.data.map((s, i) => (
            <li
              key={`${s.kind}-${s.id}`}
              className={cn(
                'flex items-center gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)]',
                i > 0 && 'border-t border-[var(--border-subtle)]',
              )}
            >
              <FollowedLink sub={s} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={unfollow.isPending}
                aria-label={`Unfollow ${s.title}`}
                title="Unfollow"
                onClick={() => unfollow.mutate({ kind: s.kind, id: s.id })}
                className="h-[var(--space-8)] w-[var(--space-8)] shrink-0 p-0"
              >
                <X width={16} height={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FollowedLink({ sub }: { sub: Subscription }) {
  const Icon = sub.kind === 'space' ? Folder : FileText
  const inner = (
    <span className="flex min-w-0 flex-1 items-center gap-[var(--space-2)]">
      <Icon
        width={16}
        height={16}
        className="shrink-0 text-[var(--text-muted)]"
        aria-hidden="true"
      />
      <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)]">
        {sub.title}
      </span>
      <span className="shrink-0 text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)]">
        {sub.kind}
      </span>
    </span>
  )
  if (sub.kind === 'space') {
    return (
      <Link to="/spaces/$spaceId" params={{ spaceId: sub.id }} className="min-w-0 flex-1 no-underline">
        {inner}
      </Link>
    )
  }
  return (
    <Link
      to="/spaces/$spaceId/pages/$pageId/{-$slug}"
      params={{ spaceId: sub.space_id ?? 0, pageId: sub.id, slug: undefined }}
      className="min-w-0 flex-1 no-underline"
    >
      {inner}
    </Link>
  )
}
