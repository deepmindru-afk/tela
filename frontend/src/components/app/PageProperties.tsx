import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

// formatScalar renders a single non-container value for display.
function formatScalar(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

// formatPropValue flattens any frontmatter value to a readable string. Scalars
// pass through; arrays join with commas; objects fall back to compact JSON.
function formatPropValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.map(formatScalar).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return formatScalar(v)
}

export interface PagePropertiesProps {
  /** The page's free-form props bag (frontmatter). Absent/empty → renders nothing. */
  props?: Record<string, unknown> | null
  className?: string
}

/**
 * PageProperties — read-only display of a page's frontmatter properties, shown
 * between the title and the editor body. Deliberately quiet: collapsed by
 * default to a small muted toggle so pages with metadata aren't visually
 * dominated by it; expands to a key/value list on click. Renders nothing when a
 * page has no properties. Editing is a deliberate follow-up.
 */
export function PageProperties({ props, className }: PagePropertiesProps) {
  const entries = props ? Object.entries(props) : []
  const [open, setOpen] = useState(false)
  if (entries.length === 0) return null
  return (
    <div className={cn('flex flex-col', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'group inline-flex items-center gap-[var(--space-1)] self-start',
          '-ml-[var(--space-1)] px-[var(--space-1)] py-[1px]',
          'rounded-[var(--radius-sm)]',
          'text-[length:var(--text-xs)] text-[var(--text-muted)]',
          'font-[family-name:var(--font-sans)]',
          'transition-colors hover:text-[var(--text-primary)]',
        )}
      >
        <ChevronRight
          aria-hidden
          width={12}
          height={12}
          className={cn(
            'shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
        {entries.length} {entries.length === 1 ? 'property' : 'properties'}
      </button>
      {open ? (
        <dl className="m-0 mt-[var(--space-2)] grid grid-cols-[minmax(0,10rem)_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-1)] pl-[var(--space-1)]">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="truncate text-[length:var(--text-sm)] text-[var(--text-muted)] font-[family-name:var(--font-mono)]">
                {key}
              </dt>
              <dd className="m-0 min-w-0 break-words text-[length:var(--text-sm)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
                {formatPropValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
