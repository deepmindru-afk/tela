import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Building2, ChevronRight, Globe, Trash2 } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { useCreateOrg, useOrgs } from '../../lib/queries/orgs'
import {
  useCreateOrgDomain,
  useDeleteOrgDomain,
  useOrgDomains,
} from '../../lib/queries/org-domains'
import type { Org } from '../../lib/types'
import { PlanTierSelect } from './PlanTierSelect'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { cn } from '../../lib/utils'
import { ruPlural } from '../../lib/ru-plural'

// Russian plural for counted nouns: 1 участник, 2 участника, 5 участников.
// The Organizations tab is now just an index: a list of orgs that each link to
// the dedicated per-org management page (route /settings/orgs/$orgId), plus org
// creation and the instance-wide auto-join domain map. Everything that used to
// live in the crowded "Members of X" dialog — members, groups, SSO, activity —
// moved to OrgManageView. scope === 'instance' is the instance-admin view
// (every org, create, domain mapping); scope === 'admin' is the org-admin
// self-service view (only the orgs they administer, no create/domains).
export function SettingsOrgsTab({
  scope = 'instance',
}: {
  scope?: 'instance' | 'admin'
}) {
  const orgs = useOrgs()
  const [createOpen, setCreateOpen] = useState(false)
  const isInstance = scope === 'instance'

  const visibleOrgs = isInstance
    ? orgs.data ?? []
    : (orgs.data ?? []).filter((o) => o.my_role === 'admin')

  return (
    <section
      aria-labelledby="settings-orgs"
      className="flex flex-col gap-[var(--space-6)]"
    >
      <div className="flex flex-col gap-[var(--space-4)]">
        <header className="flex items-start justify-between gap-[var(--space-3)]">
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
            {isInstance
              ? 'Организации объединяют людей, чтобы всю команду можно было сразу допустить к пространству. Откройте организацию, чтобы управлять её участниками, группами и единым входом.'
              : 'Организации, которыми вы управляете. Откройте организацию, чтобы управлять её участниками и группами и посмотреть недавние изменения в доступе. Создание организаций и привязка почтовых доменов выполняются администратором инстанса.'}
          </p>
          {isInstance ? (
            <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
              <Building2 width={14} height={14} />
              <span>Новая организация</span>
            </Button>
          ) : null}
        </header>

        {orgs.isLoading ? (
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            Загрузка организаций…
          </p>
        ) : orgs.isError ? (
          <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
            Не удалось загрузить организации.
          </p>
        ) : visibleOrgs.length > 0 ? (
          <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
            {visibleOrgs.map((org) => (
              <OrgRow key={org.id} org={org} scope={scope} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            {isInstance
              ? 'Организаций пока нет. Создайте первую, чтобы начать объединять участников.'
              : 'Вы не управляете ни одной организацией.'}
          </p>
        )}
      </div>

      {isInstance ? (
        <>
          <hr className="border-0 border-t border-[var(--border-subtle)]" />
          <DomainsSection orgs={orgs.data ?? []} />
          <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />
        </>
      ) : null}
    </section>
  )
}

function OrgRow({ org, scope }: { org: Org; scope: 'instance' | 'admin' }) {
  return (
    <li
      className={cn(
        'm-0 list-none flex items-center gap-[var(--space-3)]',
        'px-[var(--space-3)] py-[var(--space-3)]',
        'rounded-[var(--radius-sm)]',
        'border border-[var(--border-subtle)] bg-[var(--surface-1)]',
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
        <div className="flex items-center gap-[var(--space-2)] min-w-0 flex-wrap">
          <Link
            to="/settings/orgs/$orgId"
            params={{ orgId: org.id }}
            className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium font-[family-name:var(--font-sans)] no-underline hover:underline"
          >
            {org.name}
          </Link>
          <Badge variant="muted">
            {org.member_count} {ruPlural(org.member_count, 'участник', 'участника', 'участников')}
          </Badge>
        </div>
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-mono)]">
          {org.slug}
        </span>
      </div>

      {scope === 'instance' ? (
        <PlanTierSelect
          accountKind="org"
          accountId={org.id}
          currentKey={org.plan_key}
          className="w-[9rem] shrink-0"
        />
      ) : null}
      <Button asChild variant="secondary" size="sm">
        <Link to="/settings/orgs/$orgId" params={{ orgId: org.id }}>
          <span>Управление</span>
          <ChevronRight width={14} height={14} />
        </Link>
      </Button>
    </li>
  )
}

function CreateOrgDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createOrg = useCreateOrg()

  function reset() {
    setName('')
    setSlug('')
    setError(null)
  }

  function handleClose(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Название обязательно.')
      return
    }
    setError(null)
    const trimmedSlug = slug.trim()
    try {
      await createOrg.mutateAsync({
        name: trimmedName,
        ...(trimmedSlug ? { slug: trimmedSlug } : {}),
      })
      handleClose(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Организация с таким слагом уже существует.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Не удалось создать организацию.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создание организации</DialogTitle>
          <DialogDescription>
            Участников можно будет добавить после создания.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-3)]" noValidate>
          <div className="flex flex-col gap-[var(--space-2)]">
            <label htmlFor="new-org-name" className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
              Название
            </label>
            <Input
              id="new-org-name"
              autoFocus
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error != null}
            />
          </div>
          <div className="flex flex-col gap-[var(--space-2)]">
            <label htmlFor="new-org-slug" className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
              Слаг <span className="text-[var(--text-muted)]">(необязательно — формируется из названия)</span>
            </label>
            <Input
              id="new-org-slug"
              autoComplete="off"
              placeholder="acme-inc"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              aria-invalid={error != null}
            />
          </div>
          {error ? (
            <p role="alert" className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createOrg.isPending}>
              {createOrg.isPending ? 'Создание…' : 'Создать организацию'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DomainsSection({ orgs }: { orgs: Org[] }) {
  const domains = useOrgDomains()
  const [domain, setDomain] = useState('')
  const [orgId, setOrgId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const createDomain = useCreateOrgDomain()
  const deleteDomain = useDeleteOrgDomain()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = domain.trim()
    if (!trimmed) {
      setError('Домен обязателен.')
      return
    }
    if (orgId === '') {
      setError('Выберите организацию, к которой привязывается домен.')
      return
    }
    setError(null)
    try {
      await createDomain.mutateAsync({ domain: trimmed, org_id: orgId })
      setDomain('')
      setOrgId('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Этот домен уже привязан к организации.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Не удалось добавить домен.')
      }
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <header className="flex flex-col gap-[var(--space-1)]">
        <h2 className="m-0 flex items-center gap-[var(--space-2)] font-[family-name:var(--font-sans)] text-[length:var(--text-lg)] text-[var(--text-primary)]">
          <Globe width={16} height={16} />
          Домены автоприсоединения
        </h2>
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
          Пользователь, чей подтверждённый почтовый домен совпадает, при входе
          автоматически зачисляется в привязанную организацию как{' '}
          <strong className="font-medium text-[var(--text-primary)]">участник</strong> —
          членство определяется по учётной записи, поэтому исключить его можно только
          вместе с удалением привязки. Домены здесь также направляют пользователей к
          единому входу организации. Избегайте публичных сервисов вроде gmail.com.
        </p>
      </header>

      {domains.data && domains.data.length > 0 ? (
        <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
          {domains.data.map((d) => (
            <li
              key={d.domain}
              className={cn(
                'm-0 list-none flex items-center gap-[var(--space-3)]',
                'px-[var(--space-3)] py-[var(--space-2)]',
                'rounded-[var(--radius-sm)]',
                'border border-[var(--border-subtle)] bg-[var(--surface-1)]',
              )}
            >
              <div className="flex-1 min-w-0 flex items-center gap-[var(--space-2)] flex-wrap">
                <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)] font-[family-name:var(--font-mono)]">
                  {d.domain}
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">→</span>
                <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)]">
                  {d.org_name}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Удалить ${d.domain}`}
                onClick={() => void deleteDomain.mutateAsync(d.domain)}
                disabled={deleteDomain.isPending}
                className="text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                <Trash2 width={14} height={14} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Домены автоприсоединения не настроены.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-[var(--space-2)] pt-[var(--space-3)] border-t border-[var(--border-subtle)]"
      >
        <label
          htmlFor="add-org-domain"
          className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]"
        >
          Привязать домен
        </label>
        <div className="flex items-start gap-[var(--space-2)] flex-wrap">
          <div className="flex-1 min-w-[10rem]">
            <Input
              id="add-org-domain"
              placeholder="acme.com"
              autoComplete="off"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              aria-invalid={error != null}
            />
          </div>
          <div className="w-[10rem] shrink-0">
            <Select
              size="md"
              aria-label="Организация для привязки домена"
              value={orgId === '' ? '' : String(orgId)}
              onChange={(e) => setOrgId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Выберите организацию…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary" disabled={createDomain.isPending}>
            <span>{createDomain.isPending ? 'Добавление…' : 'Добавить'}</span>
          </Button>
        </div>
        {error ? (
          <p role="alert" className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  )
}
