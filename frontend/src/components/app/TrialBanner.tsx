import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { useMe } from '../../lib/queries/auth'
import { localDateFromSqlite } from '../../lib/relativeTime'

// App-wide notice for a trial in its final stretch. The backend only sends
// `trial` during the notify window (last 7 days + the 7-day grace), so this
// renders exactly when it's actionable — no client-side date math to decide
// visibility. Self-serve upgrade isn't wired yet (Polar deferred), so the CTA
// just points at Plan & Usage.
export function TrialBanner() {
  const me = useMe()
  const trial = me.data?.trial
  if (!trial) return null

  const message = trial.ended
    ? `Your ${trial.plan_name} trial has ended — full access continues until ${localDateFromSqlite(trial.grace_ends_at)}, then you'll move to your base plan.`
    : `Your ${trial.plan_name} trial ends ${localDateFromSqlite(trial.ends_at)}.`

  return (
    <div
      role="status"
      className="flex items-center gap-[var(--space-2)] border-b border-[var(--border-subtle)] bg-[var(--surface-2)] px-[var(--space-6)] py-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-primary)]"
    >
      <Clock width={15} height={15} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
      <span className="min-w-0 flex-1">{message}</span>
      <Link
        to="/settings"
        search={{ tab: 'billing' }}
        className="shrink-0 font-medium text-[var(--accent)] no-underline hover:underline"
      >
        View plan
      </Link>
    </div>
  )
}
