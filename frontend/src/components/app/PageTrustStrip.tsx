import { AlertTriangle, Bot, Clock, RefreshCw, User } from 'lucide-react'
import { useProvenance } from '../../lib/queries/pages'
import { daysSinceSqlite, relativeTimeFromSqlite } from '../../lib/relativeTime'
import { cn } from '../../lib/utils'

// PageTrustStrip — the read-only "epistemic" byline under a page title: a quiet
// line that tells you how much to trust what you're reading, computed (never
// written) from signals tela already has. Slice 1 carries the two honest,
// non-redundant ones:
//   • freshness — how long since the last edit, flipped to a warning when the
//     page is old or past a `review_every_days` cadence it declares in props;
//   • provenance — whether a human, an agent, or a sync last touched it.
// (Corroboration/contradiction — "do my other pages back this up?" — needs the
// agreement pass and lands in a later slice, where it can be labelled honestly.)

// STALE_DAYS: past this with no declared review cadence, a page reads as possibly
// stale. ~4 months — long enough not to nag living docs, short enough to flag rot.
const STALE_DAYS = 120

function numProp(
  props: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const v = props?.[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v)
  }
  return null
}

export function PageTrustStrip({
  pageId,
  updatedAt,
  props,
}: {
  pageId: number
  updatedAt: string
  props?: Record<string, unknown>
}) {
  const prov = useProvenance(pageId)

  const ageDays = daysSinceSqlite(updatedAt)
  const reviewEvery = numProp(props, 'review_every_days')
  const overdue = reviewEvery != null && ageDays > reviewEvery
  const stale = overdue || ageDays > STALE_DAYS
  const source = prov.data?.source
  const editor = prov.data?.editor

  return (
    <div className="flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
      {/* Freshness — the headline signal; warns amber when old / overdue. */}
      <span
        className={cn(
          'inline-flex items-center gap-[var(--space-1)]',
          stale && 'text-[var(--warning)]',
        )}
      >
        {stale ? (
          <AlertTriangle width={12} height={12} aria-hidden />
        ) : (
          <Clock width={12} height={12} aria-hidden />
        )}
        <span>
          Updated {relativeTimeFromSqlite(updatedAt)}
          {overdue ? ' · review overdue' : ''}
        </span>
      </span>

      {/* Provenance — who/what last touched it. Agent is accented (the case worth
          noticing); sync and human are muted. */}
      {source === 'agent' ? (
        <span className="inline-flex items-center gap-[var(--space-1)] text-[var(--accent)]">
          <Bot width={12} height={12} aria-hidden /> Agent-written
        </span>
      ) : source === 'sync' ? (
        <span className="inline-flex items-center gap-[var(--space-1)]">
          <RefreshCw width={12} height={12} aria-hidden /> Synced
        </span>
      ) : source === 'human' && editor ? (
        <span className="inline-flex items-center gap-[var(--space-1)]">
          <User width={12} height={12} aria-hidden /> by {editor}
        </span>
      ) : null}
    </div>
  )
}
