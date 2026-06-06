import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type EmptyStateTone = 'default' | 'danger'

export interface EmptyStateProps {
  /** Lucide icon shown in the tinted medallion. */
  icon: LucideIcon
  title: string
  description?: ReactNode
  /** Medallion tint. `danger` for failures (load error), `default` otherwise. */
  tone?: EmptyStateTone
  /** Action row — typically one or two <Button>s and/or a hint. */
  actions?: ReactNode
  /**
   * Fill the viewport, for full-page route fallbacks (the unmatched-route 404).
   * Default fills the parent content area, for in-shell states (a missing page
   * inside the app, where the sidebar stays).
   */
  fullScreen?: boolean
  className?: string
}

// Medallion tint per tone. color-mix on a semantic token is the established
// idiom here (see --sidebar-item-active in tokens.css), so it adapts across all
// three themes with no per-theme override.
const TONE: Record<EmptyStateTone, { medallion: string }> = {
  default: {
    medallion:
      'bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] text-[var(--accent)] ring-[color-mix(in_oklch,var(--accent)_22%,transparent)]',
  },
  danger: {
    medallion:
      'bg-[color-mix(in_oklch,var(--danger)_12%,transparent)] text-[var(--danger)] ring-[color-mix(in_oklch,var(--danger)_22%,transparent)]',
  },
}

/**
 * The owned primitive for any "nothing here / not found / load failed" surface.
 * A tinted icon medallion, a title, an optional description, and an optional
 * action row — centered, token-only, themed. Used by the route-level 404, the
 * in-shell page-not-found, the page load-error retry, and empty lists.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = 'default',
  actions,
  fullScreen = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center p-[var(--space-7)]',
        fullScreen ? 'min-h-dvh bg-[var(--surface-1)]' : 'flex-1',
        className,
      )}
    >
      <div className="flex flex-col items-center text-center gap-[var(--space-4)] max-w-[28rem]">
        <span
          className={cn(
            'flex items-center justify-center size-[calc(var(--space-8)+var(--space-4))] rounded-[var(--radius-lg)] ring-1 ring-inset',
            TONE[tone].medallion,
          )}
        >
          <Icon size="1.5rem" strokeWidth={1.75} aria-hidden />
        </span>

        <div className="flex flex-col gap-[var(--space-1)]">
          <h2 className="m-0 text-[length:var(--text-xl)] leading-[var(--leading-tight)] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="mt-[var(--space-2)] flex items-center justify-center gap-[var(--space-3)]">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}
