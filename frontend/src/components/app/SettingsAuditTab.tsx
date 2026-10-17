import { useState } from 'react'
import { useAccessAudit } from '../../lib/queries/access-audit'
import { IncludeAdminsToggle } from './IncludeAdminsToggle'
import { localDateFromSqlite } from '../../lib/relativeTime'
import type { AccessAuditEntry } from '../../lib/types'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

// Human labels for the audit action codes the backend emits.
const ACTION_LABEL: Record<string, string> = {
  'org.create': 'Создана организация',
  'org.delete': 'Организация удалена',
  'org_member.add': 'Добавлен участник организации',
  'org_member.remove': 'Участник организации удалён',
  'org_member.role': 'Изменена роль в организации',
  'org_member.auto_join': 'Автоматическое присоединение',
  'grant.add': 'Пространство открыто для организации',
  'grant.role': 'Изменена роль доступа для организации',
  'grant.remove': 'Доступ для организации отозван',
  'domain.map': 'Добавлен домен автоприсоединения',
}

export function SettingsAuditTab() {
  const [includeAdmins, setIncludeAdmins] = useState(false)
  const audit = useAccessAudit(includeAdmins)

  return (
    <section
      aria-labelledby="settings-audit"
      className="flex flex-col gap-[var(--space-4)]"
    >
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
          Недавние изменения в управлении доступом — участие в организациях,
          доступы к пространствам, автоприсоединение и домены. Сначала самые новые.
        </p>
        <IncludeAdminsToggle checked={includeAdmins} onChange={setIncludeAdmins} />
      </div>

      {audit.isLoading ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Загрузка журнала аудита…
        </p>
      ) : audit.isError ? (
        <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Не удалось загрузить журнал аудита.
        </p>
      ) : audit.data && audit.data.length > 0 ? (
        <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
          {audit.data.map((e) => (
            <AuditRow key={e.id} entry={e} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Изменений в доступе пока нет.
        </p>
      )}
    </section>
  )
}

export function AuditRow({ entry }: { entry: AccessAuditEntry }) {
  const label = ACTION_LABEL[entry.action] ?? entry.action
  const actor = entry.actor_username ?? 'система'
  return (
    <li
      className={cn(
        'm-0 list-none flex items-center gap-[var(--space-3)]',
        'px-[var(--space-3)] py-[var(--space-2)]',
        'rounded-[var(--radius-sm)]',
        'border border-[var(--border-subtle)] bg-[var(--surface-1)]',
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-[1px]">
        <div className="flex items-center gap-[var(--space-2)] min-w-0 flex-wrap">
          <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium font-[family-name:var(--font-sans)]">
            {label}
          </span>
          {entry.detail ? (
            <span className="truncate text-[length:var(--text-sm)] text-[var(--text-muted)]">
              {entry.detail}
            </span>
          ) : null}
        </div>
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
          {actor === 'система' ? 'система' : `от: ${actor}`} ·{' '}
          {localDateFromSqlite(entry.created_at)}
        </span>
      </div>
      <Badge variant="muted">{entry.target_kind}</Badge>
    </li>
  )
}
