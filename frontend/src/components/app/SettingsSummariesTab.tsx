import { useState } from 'react'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import {
  useSummaries,
  useSummarizeSpace,
  useSpaceSummaries,
  type PageSummaryStatus,
  type SpaceSummaries,
} from '../../lib/queries/summaries'
import { relativeTimeFromSqlite } from '../../lib/relativeTime'
import { cn } from '../../lib/utils'
import { ruPlural } from '../../lib/ru-plural'

// Russian plural for counted nouns: 1 ошибка, 2 ошибки, 5 ошибок.
// Per-page status → label + dot tone. "Pending"/"Missing" read as needs-attention
// (amber), "Failed" as broken (red); locked/empty/fresh are settled states.
type DotTone = 'ok' | 'warning' | 'danger'

const STATUS_META: Record<PageSummaryStatus, { label: string; tone: DotTone }> = {
  fresh: { label: 'Актуально', tone: 'ok' },
  stale: { label: 'В очереди', tone: 'warning' },
  missing: { label: 'Отсутствует', tone: 'warning' },
  failed: { label: 'Ошибка', tone: 'danger' },
  locked: { label: 'Заблокировано', tone: 'ok' },
  empty: { label: 'Пусто', tone: 'ok' },
}

const TONE_COLOR: Record<DotTone, string> = {
  ok: 'var(--border-strong)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

function StatusDot({ tone }: { tone: DotTone }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full w-[var(--space-2)] h-[var(--space-2)] shrink-0"
      style={{ backgroundColor: TONE_COLOR[tone] }}
    />
  )
}

// One space's row: header summary + a Summarize action, expandable to the
// per-page status list (fetched lazily on expand).
function SpaceRow({ space }: { space: SpaceSummaries }) {
  const [open, setOpen] = useState(false)
  const pageQuery = useSpaceSummaries(open ? space.space_id : null)
  const summarize = useSummarizeSpace()

  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-[var(--space-3)] p-[var(--space-4)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-[var(--space-2)] min-w-0 flex-1 text-left bg-transparent border-0 cursor-pointer p-0"
        >
          <Chevron
            aria-hidden
            width={16}
            height={16}
            className="shrink-0 text-[var(--text-muted)]"
          />
          <span className="font-medium text-[var(--text-primary)] truncate">
            {space.name}
          </span>
        </button>

        {space.failed > 0 && (
          <span className="inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--danger)]">
            <StatusDot tone="danger" />
            {space.failed} {ruPlural(space.failed, 'ошибка', 'ошибки', 'ошибок')}
          </span>
        )}
        {space.stale > 0 && (
          <span className="inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--warning)]">
            <StatusDot tone="warning" />
            {space.stale} {ruPlural(space.stale, 'ожидает', 'ожидают', 'ожидают')}
          </span>
        )}
        {space.failed === 0 && space.stale === 0 && (
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
            Всё суммировано
          </span>
        )}

        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] tabular-nums hidden sm:inline">
          {space.summarized}/{space.pages} с сводками
        </span>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={summarize.isPending}
          onClick={() => summarize.mutate(space.space_id)}
        >
          <Sparkles
            aria-hidden
            width={14}
            height={14}
            className={cn(summarize.isPending && 'animate-pulse')}
          />
          {summarize.isPending ? 'В очередь…' : 'Суммировать'}
        </Button>
      </div>

      {open && (
        <div className="border-0 border-t border-[var(--border-subtle)] bg-[var(--surface-1)]">
          {pageQuery.isLoading && (
            <p className="m-0 p-[var(--space-4)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
              Загрузка страниц…
            </p>
          )}
          {pageQuery.data && pageQuery.data.pages.length === 0 && (
            <p className="m-0 p-[var(--space-4)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
              В этом пространстве нет страниц.
            </p>
          )}
          {pageQuery.data && pageQuery.data.pages.length > 0 && (
            <ul className="list-none m-0 p-0">
              {pageQuery.data.pages.map((p) => {
                const meta = STATUS_META[p.status]
                return (
                  <li
                    key={p.page_id}
                    className="flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] border-0 border-t border-[var(--border-subtle)] first:border-t-0"
                  >
                    <StatusDot tone={meta.tone} />
                    <span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)] text-[var(--text-primary)]">
                      {p.title || 'Без названия'}
                    </span>
                    {p.status === 'failed' && p.last_error && (
                      <span
                        title={p.last_error}
                        className="max-w-[12rem] truncate text-[length:var(--text-xs)] text-[var(--danger)]"
                      >
                        {p.last_error}
                      </span>
                    )}
                    {p.generated_at && (
                      <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] hidden sm:inline">
                        {relativeTimeFromSqlite(p.generated_at)}
                      </span>
                    )}
                    <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
                      {meta.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

// Settings → "Summaries": auto-summary health for every space the user can
// access, with a per-space Summarize action and an expandable per-page status
// list. Backed by GET /api/summaries/status. Renders a clear disabled state
// when the server has no LLM configured.
export function SettingsSummariesTab() {
  const { data, isLoading, isError } = useSummaries()

  if (isLoading) {
    return (
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        Загрузка статуса сводок…
      </p>
    )
  }
  if (isError || !data) {
    return (
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        Не удалось загрузить статус сводок.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        Сводки страниц пишет настроенная LLM: они обновляются автоматически
        через несколько секунд после изменения текста страницы; кнопка «Суммировать»
        ставит в очередь всё, что ещё ожидает, в выбранном пространстве.
        {data.enabled && data.model && (
          <>
            {' '}
            Модель: <strong className="text-[var(--text-primary)]">{data.model}</strong>.
          </>
        )}
      </p>

      {!data.enabled && (
        <Card className="p-[var(--space-4)]">
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            Автоматические сводки на этом сервере <strong className="text-[var(--text-primary)]">не настроены</strong> —
            приведённые ниже счётчики отражают существующие сводки, но новые создаваться
            не будут, пока не будет настроена LLM.
          </p>
        </Card>
      )}

      {data.spaces.length === 0 ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Нет пространств для суммирования.
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--space-3)]">
          {data.spaces.map((s) => (
            <SpaceRow key={s.space_id} space={s} />
          ))}
        </div>
      )}
    </div>
  )
}
