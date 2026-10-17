import {
  useActivityGroups,
  type ActivityGroup,
  type ActivityGroupBy,
} from '../../lib/queries/admin-activity-groups'
import type { AdminUserWindow } from '../../lib/types'
import { DataTable, type DataTableColumn } from '../ui/data-table'
import { relativeTimeFromSqlite } from '../../lib/relativeTime'
import { ruPlural } from '../../lib/ru-plural'

// The People table keyed by content (spaces) or by team (orgs). Same window,
// same primitive, same reading — "what here is actually alive".
export function ActivityGroupsTable({
  by,
  window,
}: {
  by: ActivityGroupBy
  window: AdminUserWindow
}) {
  const groups = useActivityGroups(by, window, true)
  const rows = groups.data ?? []

  const columns: DataTableColumn<ActivityGroup>[] = [
    {
      key: 'name',
      header: by === 'org' ? 'Команда' : 'Пространство',
      sticky: 'left',
      group: 'Кто',
      sortValue: (g) => g.name.toLowerCase(),
      cell: (g) => (
        <div className="flex flex-col gap-[2px] min-w-[10rem]">
          <span className="font-medium">{g.name || 'Без названия'}</span>
          {g.detail ? (
            <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
              {by === 'org' ? g.detail : `@${g.detail}`}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'people',
      header: by === 'org' ? 'Активные участники' : 'Авторы правок',
      group: 'Кто',
      title:
        by === 'org'
          ? 'Участники с любой активностью за период — от общего числа участников команды.'
          : 'Разные люди, писавшие в этом пространстве за период.',
      numeric: true,
      sortValue: (g) => g.active_people,
      cell: (g) =>
        by === 'org' ? (
          <span>
            {g.active_people} <span className="text-[var(--text-muted)]">/ {g.people}</span>
          </span>
        ) : (
          <Num n={g.people} />
        ),
    },
    {
      key: 'edits',
      header: 'Правки',
      group: 'Записи',
      scale: (g: ActivityGroup) => g.edits,
      title: 'Версии, созданные за период. Доли агентов и синхронизаций показаны отдельно: синхронизированный репозиторий может добавить тысячи правок, которые никто не печатал вручную.',
      numeric: true,
      sortValue: (g) => g.edits,
      cell: (g) => (
        <div className="flex flex-col items-end">
          <Num n={g.edits} />
          {g.agent_edits > 0 || g.sync_edits > 0 ? (
            <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] whitespace-nowrap">
              {[
                g.agent_edits > 0
                  ? `${g.agent_edits} ${ruPlural(g.agent_edits, 'агент', 'агента', 'агентов')}`
                  : '',
                g.sync_edits > 0
                  ? `${g.sync_edits} ${ruPlural(g.sync_edits, 'синхронизация', 'синхронизации', 'синхронизаций')}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'views',
      header: 'Просмотры',
      group: 'Чтение',
      numeric: true,
      scale: (g: ActivityGroup) => g.views,
      sortValue: (g) => g.views,
      cell: (g) => <Num n={g.views} />,
    },
    {
      key: 'asks',
      header: 'Запросы',
      group: 'Чтение',
      numeric: true,
      scale: (g: ActivityGroup) => g.asks,
      sortValue: (g) => g.asks,
      cell: (g) => <Num n={g.asks} />,
    },
    ...(by === 'org'
      ? [
          {
            key: 'ai',
            header: 'AI',
            group: 'Чтение',
            numeric: true,
            sortValue: (g: ActivityGroup) => g.llm_calls,
            cell: (g: ActivityGroup) => <Num n={g.llm_calls} />,
          },
        ]
      : [
          {
            key: 'pages',
            header: 'Страницы',
            group: 'Содержит',
            title: 'Актуальные страницы в пространстве прямо сейчас — без привязки к периоду.',
            numeric: true,
            sortValue: (g: ActivityGroup) => g.pages,
            cell: (g: ActivityGroup) => <Num n={g.pages} />,
          },
          {
            key: 'last',
            header: 'Последняя правка',
            group: 'Содержит',
            sortValue: (g: ActivityGroup) => g.last_active,
            cell: (g: ActivityGroup) =>
              g.last_active ? (
                <span className="whitespace-nowrap">{relativeTimeFromSqlite(g.last_active)}</span>
              ) : (
                <span className="text-[var(--text-muted)]">Никогда</span>
              ),
          },
        ]),
  ]

  if (groups.isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Загрузка активности"
        className="flex flex-col gap-[1px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[var(--space-8)] bg-[var(--surface-2)] opacity-60 animate-pulse" />
        ))}
      </div>
    )
  }
  if (groups.isError) {
    return (
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
        Не удалось загрузить активность.
      </p>
    )
  }

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(g) => g.id}
        defaultSort={{ key: 'edits', dir: 'desc' }}
        stale={groups.isFetching}
        caption={by === 'org' ? 'Активность по командам' : 'Активность по пространствам'}
        empty={by === 'org' ? 'Команд пока нет.' : 'Пространств пока нет.'}
      />
      <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
        {by === 'org'
          ? 'Активность команды — это активность её участников, где бы они ни работали, поэтому человек в двух командах учитывается в обеих.'
          : 'Активность пространства — это то, что происходило с его страницами, кто бы ни это делал. Личные пространства учитываются.'}
      </p>
    </>
  )
}

function Num({ n }: { n: number }) {
  if (n === 0) return <span className="text-[var(--text-muted)]">—</span>
  return <span>{n.toLocaleString()}</span>
}
