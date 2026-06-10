import type { ReactNode } from 'react'
import { Text } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

/**
 * pageSummary — the standfirst a page declares in frontmatter. Same key
 * preference as the blog index excerpt and the public reader's meta
 * description (summary > excerpt > description), so every surface agrees on
 * what "the summary" is.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function pageSummary(
  props?: Record<string, unknown> | null,
): string | null {
  if (!props) return null
  for (const k of ['summary', 'excerpt', 'description']) {
    const v = props[k]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return null
}

export interface SummaryTitleProps {
  /** No summary → children render bare, zero added chrome. */
  summary: string | null
  /** Positioning of the gutter icon within the title row. */
  hintClassName?: string
  /** The title element (h1). */
  children: ReactNode
}

/**
 * SummaryTitle — wraps a page title and, when the page declares a summary,
 * makes the whole title row a hover target: an icon fades into the left
 * gutter as the affordance, and hovering anywhere on the title (or focusing
 * the icon) opens a readable summary card beside it.
 */
export function SummaryTitle({
  summary,
  hintClassName,
  children,
}: SummaryTitleProps) {
  if (!summary) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="group relative">
          <button
            type="button"
            aria-label="Page summary"
            className={cn(
              'items-center justify-center h-[var(--space-6)] w-[var(--space-6)]',
              'rounded-[var(--radius-sm)] border-none bg-transparent p-0 cursor-default',
              'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]',
              'opacity-0 transition-opacity duration-[var(--duration-fast)]',
              'group-hover:opacity-100 focus-visible:opacity-100',
              'group-data-[state=delayed-open]:opacity-100 group-data-[state=instant-open]:opacity-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              hintClassName,
            )}
          >
            <Text width={14} height={14} />
          </button>
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-[24rem] p-[var(--space-3)] text-[length:var(--text-sm)] leading-[var(--leading-normal)]"
      >
        <p className="m-0 mb-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-mono)]">
          summary
        </p>
        <p className="m-0">{summary}</p>
      </TooltipContent>
    </Tooltip>
  )
}
