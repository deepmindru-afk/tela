import { Braces } from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

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
}

/**
 * PageProperties — read-only frontmatter properties, surfaced as a single quiet
 * header icon that opens the key/value list in a popover. Renders nothing when a
 * page has no properties, so it never adds chrome to a page without metadata.
 * (Reuses the owned DropdownMenu primitive as the popover; editing is a
 * deliberate follow-up.)
 */
export function PageProperties({ props }: PagePropertiesProps) {
  const entries = props ? Object.entries(props) : []
  if (entries.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Page properties"
          title="Properties"
          className="h-[var(--space-8)] w-[var(--space-8)] p-0"
        >
          <Braces width={16} height={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[16rem] max-w-[22rem] p-[var(--space-3)]"
      >
        <dl className="m-0 grid grid-cols-[minmax(0,8rem)_1fr] gap-x-[var(--space-3)] gap-y-[var(--space-1)]">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="truncate text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-mono)]">
                {key}
              </dt>
              <dd className="m-0 min-w-0 break-words text-[length:var(--text-xs)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
                {formatPropValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
