import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

// StatusBadge — a small status pill for run / source states. Each tone pairs a
// soft surface tint with the matching semantic foreground for text + border, so
// a state reads at a glance without shouting. `running` is the in-progress tone:
// pass `dot` and its leading dot pulses (guarded — the pulse only runs under
// `motion-safe`, so `prefers-reduced-motion: reduce` falls back to a steady dot).
// Sizing/typography mirror Badge (text-xs, rounded-sm, the same padding rhythm).

const statusBadgeVariants = cva(
  [
    'inline-flex items-center gap-[var(--space-1)]',
    'font-[family-name:var(--font-sans)]',
    'leading-[var(--leading-tight)]',
    'rounded-[var(--radius-sm)]',
    'border',
    'whitespace-nowrap',
    'text-[length:var(--text-xs)]',
    'px-[var(--space-2)] py-[1px]',
  ],
  {
    variants: {
      tone: {
        neutral: [
          'bg-[var(--surface-1)] text-[var(--text-muted)]',
          'border-[var(--border-subtle)]',
        ],
        positive: [
          'bg-[var(--accent-positive-soft)] text-[var(--accent-positive-fg)]',
          'border-[var(--accent-positive-fg)]',
        ],
        negative: [
          'bg-[var(--accent-negative-soft)] text-[var(--accent-negative-fg)]',
          'border-[var(--accent-negative-fg)]',
        ],
        warning: [
          'bg-[var(--accent-warning-soft)] text-[var(--accent-warning-fg)]',
          'border-[var(--accent-warning-fg)]',
        ],
        info: [
          'bg-[var(--accent-info-soft)] text-[var(--accent-info-fg)]',
          'border-[var(--accent-info-fg)]',
        ],
        running: [
          'bg-[var(--accent-info-soft)] text-[var(--accent-info-fg)]',
          'border-[var(--accent-info-fg)]',
        ],
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

// Dot color tracks the tone's foreground (neutral = muted text).
const dotColor: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  neutral: 'var(--text-muted)',
  positive: 'var(--accent-positive-fg)',
  negative: 'var(--accent-negative-fg)',
  warning: 'var(--accent-warning-fg)',
  info: 'var(--accent-info-fg)',
  running: 'var(--accent-info-fg)',
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Render a small leading status dot in the tone color. */
  dot?: boolean
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  function StatusBadge({ className, tone, dot, children, ...props }, ref) {
    const t = tone ?? 'neutral'
    return (
      <span
        ref={ref}
        className={cn(statusBadgeVariants({ tone }), className)}
        {...props}
      >
        {dot && (
          <span
            aria-hidden="true"
            className={cn(
              'inline-block size-[var(--space-2)] rounded-[var(--radius-lg)]',
              // Only the in-progress tone pulses; motion-safe guards reduced-motion.
              t === 'running' && 'motion-safe:animate-pulse',
            )}
            style={{ backgroundColor: dotColor[t] }}
          />
        )}
        {children}
      </span>
    )
  },
)
