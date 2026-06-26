import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

// CoverageGauge — a radial gauge for a 0..1 coverage ratio (e.g. atlas's
// must-cover %). A full track ring sits behind a progress arc whose length
// encodes the value; the arc stroke ramps by band — low → negative, mid →
// warning, high → positive. The arc transition is guarded (`motion-safe`), so
// `prefers-reduced-motion: reduce` paints a static arc. SVG geometry numbers are
// literals (geometry, not design spacing); every color is a token var.

type GaugeSize = 'sm' | 'md' | 'lg'

export interface CoverageGaugeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 0..1 coverage ratio (clamped). */
  value: number
  /** Caption under the percentage, e.g. "must-cover". */
  caption?: string
  size?: GaugeSize
}

// Pixel dimensions + the label type token per size.
const sizing: Record<GaugeSize, { box: number; pct: string }> = {
  sm: { box: 64, pct: 'var(--text-sm)' },
  md: { box: 96, pct: 'var(--text-lg)' },
  lg: { box: 128, pct: 'var(--text-2xl)' },
}

function arcColor(value: number): string {
  if (value >= 0.9) return 'var(--accent-positive-fg)'
  if (value >= 0.5) return 'var(--accent-warning-fg)'
  return 'var(--accent-negative-fg)'
}

// SVG geometry (literals — not design tokens).
const VIEW = 100
const R = 42
const STROKE = 10
const CIRC = 2 * Math.PI * R

export const CoverageGauge = forwardRef<HTMLDivElement, CoverageGaugeProps>(
  function CoverageGauge(
    { value, caption, size = 'md', className, ...props },
    ref,
  ) {
    const ratio = Math.min(Math.max(value, 0), 1)
    const pct = Math.round(ratio * 100)
    const { box, pct: pctSize } = sizing[size]
    return (
      <div
        ref={ref}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={caption}
        className={cn('relative inline-flex shrink-0', className)}
        style={{ width: box, height: box }}
        {...props}
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={VIEW / 2}
            cy={VIEW / 2}
            r={R}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={STROKE}
          />
          <circle
            cx={VIEW / 2}
            cy={VIEW / 2}
            r={R}
            fill="none"
            stroke={arcColor(ratio)}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ratio * CIRC} ${CIRC}`}
            className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-[var(--duration-base)] motion-safe:ease-[var(--ease-out)]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1px]">
          <span
            className="font-[family-name:var(--font-mono)] leading-[var(--leading-tight)] text-[var(--text-primary)]"
            style={{ fontSize: pctSize }}
          >
            {pct}%
          </span>
          {caption && (
            <span className="text-[length:var(--text-xs)] leading-[var(--leading-tight)] text-[var(--text-muted)]">
              {caption}
            </span>
          )}
        </div>
      </div>
    )
  },
)
