import { ChevronRight, FileText, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardBody } from '../ui/card'
import { cn } from '../../lib/utils'
import type { ImportResult as ImportResultPayload } from '../../lib/queries/imports'

export interface ImportResultProps {
  // Backend payload — backend doesn't know whether the call was a dry-run, so
  // the consumer of this component passes the flag through.
  result: ImportResultPayload
  dryRun: boolean
  // Dry-run only: rendered as a primary button when set. Receives the click
  // target so callers can wire up "Confirm import" submission.
  onConfirm?: () => void
  onCancel?: () => void
  confirmPending?: boolean
  // Real-import success only: rendered as a link-shaped button below the
  // summary. Wired by the parent route to navigate to the first imported page.
  onOpenFirstPage?: () => void
}

// Owned result card for the M14 markdown-import flow. Three display states:
// - dry-run preview (planned tree + Confirm/Cancel buttons)
// - real-import success summary (imported page count + links)
// - partial / errors (same skeleton — failures surface in details section)
export function ImportResult({
  result,
  dryRun,
  onConfirm,
  onCancel,
  confirmPending,
  onOpenFirstPage,
}: ImportResultProps) {
  const { summary, pages, skipped, errors } = result
  const verb = dryRun ? 'Would import' : 'Imported'
  const skippedVerb = dryRun ? 'would skip' : 'skipped'

  return (
    <Card aria-live="polite">
      <CardBody className="gap-[var(--space-4)]">
        <p
          role={dryRun ? undefined : 'status'}
          className="m-0 text-[length:var(--text-base)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]"
        >
          {verb}{' '}
          <strong className="text-[var(--accent)]">{summary.created}</strong>{' '}
          {summary.created === 1 ? 'page' : 'pages'},{' '}
          <strong>{summary.skipped}</strong> {skippedVerb},{' '}
          <strong>{summary.conflicts_renamed}</strong>{' '}
          {summary.conflicts_renamed === 1 ? 'renamed' : 'renamed'}.
        </p>

        {errors.length > 0 ? (
          <p
            role="alert"
            className={cn(
              'm-0 inline-flex items-start gap-[var(--space-2)]',
              'rounded-[var(--radius-sm)]',
              'bg-[var(--surface-1)] border border-[var(--border-subtle)]',
              'px-[var(--space-3)] py-[var(--space-2)]',
              'text-[length:var(--text-sm)] text-[var(--danger)]',
            )}
          >
            <AlertTriangle width={14} height={14} className="shrink-0 mt-[2px]" />
            <span>
              {errors.length} file{errors.length === 1 ? '' : 's'} could not be
              parsed.
            </span>
          </p>
        ) : null}

        {dryRun ? (
          <div className="flex gap-[var(--space-3)]">
            <Button
              type="button"
              variant="primary"
              onClick={onConfirm}
              disabled={confirmPending || summary.created === 0}
            >
              {confirmPending ? 'Importing…' : 'Confirm import'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
          </div>
        ) : onOpenFirstPage && pages.length > 0 ? (
          <div>
            <Button type="button" variant="primary" onClick={onOpenFirstPage}>
              Open "{pages[0].title || 'Untitled'}"
            </Button>
          </div>
        ) : null}

        {pages.length > 0 ? (
          <ImportDetails
            label={dryRun ? 'Planned pages' : 'Imported pages'}
            count={pages.length}
          >
            <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
              {pages.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    'm-0 inline-flex items-center gap-[var(--space-2)]',
                    'text-[length:var(--text-sm)] font-[family-name:var(--font-sans)]',
                    'text-[var(--text-primary)] min-w-0',
                  )}
                >
                  <FileText
                    width={14}
                    height={14}
                    className="shrink-0 text-[var(--text-muted)]"
                  />
                  <span className="truncate">{p.title || 'Untitled'}</span>
                  <span className="text-[var(--text-muted)] truncate">
                    — {p.path}
                  </span>
                </li>
              ))}
            </ul>
          </ImportDetails>
        ) : null}

        {skipped.length > 0 ? (
          <ImportDetails label="Skipped files" count={skipped.length}>
            <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
              {skipped.map((s) => (
                <li
                  key={s.path}
                  className={cn(
                    'm-0 text-[length:var(--text-sm)]',
                    'font-[family-name:var(--font-sans)] text-[var(--text-muted)]',
                    'truncate',
                  )}
                >
                  {s.path}{' '}
                  <span className="text-[var(--text-muted)]">
                    ({skippedReasonLabel(s.reason)})
                  </span>
                </li>
              ))}
            </ul>
          </ImportDetails>
        ) : null}

        {errors.length > 0 ? (
          <ImportDetails label="Ошибки" count={errors.length}>
            <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
              {errors.map((e) => (
                <li
                  key={e.path}
                  className="m-0 text-[length:var(--text-sm)] font-[family-name:var(--font-sans)] text-[var(--danger)] truncate"
                >
                  {e.path}{' '}
                  <span className="text-[var(--text-muted)]">
                    ({e.reason})
                  </span>
                </li>
              ))}
            </ul>
          </ImportDetails>
        ) : null}
      </CardBody>
    </Card>
  )
}

// Minimal owned wrapper around the native <details> element. Renders the
// chevron + count chip in the summary row; relies on the browser's built-in
// disclosure behavior for open/close. Pure tokens.
function ImportDetails({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <details className="group m-0">
      <summary
        className={cn(
          'list-none cursor-pointer',
          'inline-flex items-center gap-[var(--space-2)]',
          'text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]',
          'font-[family-name:var(--font-sans)]',
          'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-2)]',
          'rounded-[var(--radius-sm)]',
        )}
      >
        <ChevronRight
          width={14}
          height={14}
          className="text-[var(--text-muted)] transition-transform duration-[var(--duration-fast)] group-open:rotate-90"
        />
        <span>{label}</span>
        <span className="text-[var(--text-muted)] font-normal">({count})</span>
      </summary>
      <div className="pl-[calc(var(--space-2)_+_14px)] pt-[var(--space-2)]">
        {children}
      </div>
    </details>
  )
}

// Map backend reason strings to UI-friendly labels. Today the only soft-skip
// reason is `not_markdown`; future reasons (empty file, frontmatter-only,
// etc.) can be added here without changing callers.
function skippedReasonLabel(reason: string): string {
  switch (reason) {
    case 'not_markdown':
      return 'not a markdown file'
    default:
      return reason
  }
}
