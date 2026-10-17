import { useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Checkbox } from '../ui/checkbox'
import { useMe, useUpdateProfile } from '../../lib/queries/auth'
import {
  useFreshness,
  useReindexSpace,
  useSpaceFreshness,
  type PageIndexStatus,
  type SpaceFreshness,
} from '../../lib/queries/freshness'
import { cn } from '../../lib/utils'
import { ruPlural } from '../../lib/ru-plural'

// Russian plural for counted nouns: 1 страница, 2 страницы, 5 страниц.
// Per-page status → label + whether it reads as "needs attention" (amber dot).
const STATUS_META: Record<PageIndexStatus, { label: string; attention: boolean }> = {
  fresh: { label: 'Проиндексировано', attention: false },
  stale: { label: 'Изменено после индексации', attention: true },
  unindexed: { label: 'Не проиндексировано', attention: true },
  empty: { label: 'Пусто', attention: false },
}

function StatusDot({ attention }: { attention: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full w-[var(--space-2)] h-[var(--space-2)] shrink-0"
      style={{
        backgroundColor: attention ? 'var(--warning)' : 'var(--border-strong)',
      }}
    />
  )
}

// One space's row: header summary + a Reindex action, expandable to the
// per-page status list (fetched lazily on expand).
function SpaceRow({ space }: { space: SpaceFreshness }) {
  const [open, setOpen] = useState(false)
  const pageQuery = useSpaceFreshness(open ? space.space_id : null)
  const reindex = useReindexSpace()

  const needsAttention = space.stale_pages > 0
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

        {needsAttention ? (
          <span className="inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--warning)]">
            <StatusDot attention />
            {space.stale_pages} {ruPlural(space.stale_pages, 'страница требует', 'страницы требуют', 'страниц требуют')} индексации
          </span>
        ) : (
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
            Всё проиндексировано
          </span>
        )}

        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] tabular-nums hidden sm:inline">
          {space.indexed_pages}/{space.pages} страниц · {space.chunk_count} фрагментов
        </span>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={reindex.isPending}
          onClick={() => reindex.mutate(space.space_id)}
        >
          <RefreshCw
            aria-hidden
            width={14}
            height={14}
            className={cn(reindex.isPending && 'animate-spin')}
          />
          {reindex.isPending ? 'Переиндексация…' : 'Переиндексировать'}
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
                    <StatusDot attention={meta.attention} />
                    <span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)] text-[var(--text-primary)]">
                      {p.title || 'Без названия'}
                    </span>
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

// Settings → "Search index": index-health for every space the user can access,
// with a per-space Reindex action and an expandable per-page status list. Backed
// by GET /api/rag/freshness. Renders a clear disabled state when the server has
// no embedder configured.
// The account-level opt-out for the sidebar staleness dot. Lives here because
// this tab is what the dot is about — someone who wants it gone is already
// looking at indexing. Saved on the account, not in this browser, so turning it
// off follows you to your other devices.
function BackfillDotPref() {
  const me = useMe()
  const update = useUpdateProfile()
  const shown = me.data?.show_backfill_dot ?? true

  return (
    <label className="flex items-start gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
      <Checkbox
        checked={shown}
        disabled={me.isLoading || update.isPending}
        aria-label="Показывать активность индексации в боковой панели"
        onCheckedChange={(v) => update.mutate({ show_backfill_dot: v === true })}
        className="mt-[2px]"
      />
      <span className="flex flex-col gap-[1px]">
        <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
          Показывать активность индексации в боковой панели
        </span>
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
          Небольшая янтарная точка рядом со страницей или пространством, пока их
          индекс или сводка догоняет изменения. Отключение никак не влияет на саму
          индексацию — эта страница по-прежнему показывает полный статус.
        </span>
      </span>
    </label>
  )
}

// Per-space index status: counts, per-page detail, manual reindex.
function IndexStatus() {
  const { data, isLoading, isError } = useFreshness()

  if (isLoading) {
    return (
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        Загрузка статуса индекса…
      </p>
    )
  }
  if (isError || !data) {
    return (
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        Не удалось загрузить статус индекса.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        Семантический поиск разбивает содержимое страниц на фрагменты и индексирует
        их. Страницы переиндексируются автоматически через несколько секунд после
        правки; кнопка «Переиндексировать» пересобирает индекс целого пространства.
      </p>

      {!data.enabled && (
        <Card className="p-[var(--space-4)]">
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            Семантический поиск на этом сервере <strong className="text-[var(--text-primary)]">не настроен</strong> —
            приведённые ниже счётчики отражают существующий индекс, но новое содержимое
            не будет переведено в векторы, пока не настроен эмбеддер.
          </p>
        </Card>
      )}

      {data.spaces.length === 0 ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Нет пространств для индексации.
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

export function SettingsSearchIndexTab() {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <BackfillDotPref />
      <IndexStatus />
    </div>
  )
}
