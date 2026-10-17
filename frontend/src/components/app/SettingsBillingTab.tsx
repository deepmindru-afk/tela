import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, HardDrive, Layers, Sparkles, Users } from 'lucide-react'
import { useMe } from '../../lib/queries/auth'
import { useOrgs } from '../../lib/queries/orgs'
import {
  billingKeys,
  useBillingPortal,
  useCheckout,
  useMyUsage,
  useOrgUsage,
  usePlans,
} from '../../lib/queries/billing'
import type { Plan, Usage } from '../../lib/types'
import { ApiError } from '../../lib/api'
import { DOCS } from '../../lib/docs'
import { CreateTeamDialog } from './CreateTeamDialog'
import { formatBytes } from '../../lib/format'
import { localDateFromSqlite } from '../../lib/relativeTime'
import { PlanTierSelect } from './PlanTierSelect'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Progress } from '../ui/progress'
import { toast } from '../ui/toast'
import { ruPlural } from '../../lib/ru-plural'

// SettingsBillingTab — "Plan & Usage". Shows the caller's personal-account tier
// and live usage, the same for every org they belong to, and the full tier
// catalog for comparison. Instance-admins additionally get an inline tier
// selector per account (there's no self-serve billing yet — plan changes are an
// operator action).

const INFINITY = '∞'

// Capabilities every tier ships — tiers only change limits, never features.
// Every plan ships the whole product; tiers change the metered AI + team
// controls. SSO/audit are Enterprise (not every-plan) — kept off this list.
const INCLUDED = [
  'Атлас — вики с цитатами из git-репозитория или проекта Jira',
  'Семантический (RAG) и полнотекстовый поиск, вопросы к вашим документам',
  'Коннектор MCP для Claude и ChatGPT',
  'Синхронизация локальных папок через WebDAV',
  'Совместное редактирование в реальном времени',
  'Организации и роли для каждого пространства',
  'Обычный markdown, который принадлежит вам, — экспорт в любой момент',
]

// Russian plural for counted nouns: 1 источник, 2 источника, 5 источников.
function formatStorageLimit(max: number | null): string {
  return max == null ? INFINITY : formatBytes(max)
}

function formatCount(max: number | null): string {
  return max == null ? INFINITY : String(max)
}

// null cents = custom/contact tier; otherwise a whole-dollar amount ($0 for free).
function formatPrice(cents: number | null): string {
  if (cents == null) return 'По запросу'
  const dollars = cents / 100
  // Whole dollars render clean ($8); fractional prices keep the cents ($7.50)
  // instead of rounding to a wrong figure.
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

type BillingPeriod = 'month' | 'year'

// Price for the selected cadence. Yearly falls back to monthly when a tier has no
// yearly option (free / custom tiers).
function priceForPeriod(p: Plan, period: BillingPeriod): number | null {
  if (period === 'year' && p.price_cents_yearly != null) return p.price_cents_yearly
  return p.price_cents
}

// The qualifier under the amount. Monthly uses the DB-authored label; the yearly
// label is derived (the only yearly tiers are the per-account paid ones).
function periodLabel(p: Plan, period: BillingPeriod): string {
  // Paid org tiers are billed per seat — say "seat" consistently (matches the
  // CTA button, the landing, and the Polar checkout). Free/custom keep their
  // DB-authored label ("up to 5 members", "let's talk").
  const orgSeat = p.account_kind === 'org' && p.price_cents != null && p.price_cents > 0
  if (period === 'year' && p.price_cents_yearly != null) {
    return p.account_kind === 'org' ? 'за место в год' : 'в год'
  }
  if (orgSeat) return 'за место в месяц'
  return p.price_period
}

// Saving vs paying monthly for a year (whole dollars), or null if no yearly price.
function yearlySavingsDollars(p: Plan): number | null {
  if (p.price_cents == null || p.price_cents_yearly == null) return null
  const save = p.price_cents * 12 - p.price_cents_yearly
  return save > 0 ? Math.round(save / 100) : null
}

// Compact price for a CTA button, e.g. "$8/mo", "$80/yr", "$6/seat/mo".
function compactPrice(p: Plan, period: BillingPeriod): string {
  const cents = priceForPeriod(p, period)
  if (cents == null) return ''
  const yearly = period === 'year' && p.price_cents_yearly != null
  const seat = p.account_kind === 'org' ? '/место' : ''
  return `$${Math.round(cents / 100)}${seat}${yearly ? '/год' : '/мес'}`
}

// Monthly/Yearly segmented control (owned primitives + tokens) with a savings pill.
function BillingPeriodToggle({
  value,
  onChange,
}: {
  value: BillingPeriod
  onChange: (v: BillingPeriod) => void
}) {
  return (
    <div className="inline-flex items-center gap-[var(--space-2)]">
      <div className="inline-flex gap-[var(--space-1)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-[var(--space-1)]">
        <Button
          variant={value === 'month' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={value === 'month'}
          onClick={() => onChange('month')}
        >
          Ежемесячно
        </Button>
        <Button
          variant={value === 'year' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={value === 'year'}
          onClick={() => onChange('year')}
        >
          Ежегодно
        </Button>
      </div>
      {value === 'year' ? <Badge variant="accent">Экономия до 25%</Badge> : null}
    </div>
  )
}

interface MetricProps {
  icon: React.ReactNode
  label: string
  used: number
  max: number | null
  format?: (n: number) => string
}

export function Metric({ icon, label, used, max, format }: MetricProps) {
  const fmt = format ?? String
  const limit = max == null ? INFINITY : fmt(max)
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <div className="flex items-center justify-between gap-[var(--space-2)]">
        <span className="inline-flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
          <span aria-hidden className="text-[var(--text-muted)]">
            {icon}
          </span>
          {label}
        </span>
        <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] tabular-nums">
          {fmt(used)} <span className="text-[var(--text-muted)]">/ {limit}</span>
        </span>
      </div>
      <Progress value={used} max={max} />
    </div>
  )
}

// Self-serve billing controls for one account: upgrade (Polar checkout) when
// unsubscribed, or manage/cancel (customer portal) once subscribed. Rendered for
// the account's own controller (the user for their personal account; an org
// admin for an org) — the backend re-checks the same authority.
function BillingActions({
  usage,
  plans,
  period,
}: {
  usage: Usage
  plans: Plan[]
  period: BillingPeriod
}) {
  const checkout = useCheckout()
  const portal = useBillingPortal()
  const orgId = usage.account_kind === 'org' ? usage.account_id : undefined
  const sub = usage.subscription
  const busy = checkout.isPending || portal.isPending

  function onError(e: unknown) {
    toast({
      title: 'Оплата',
      description: e instanceof ApiError ? e.message : 'Что-то пошло не так',
      variant: 'destructive',
    })
  }

  // Subscribed → manage it, with a status line.
  if (sub) {
    return (
      <div className="flex flex-col gap-[var(--space-2)] border-t border-[var(--border-subtle)] pt-[var(--space-3)]">
        {sub.cancel_at_period_end && sub.period_end ? (
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
            Отмена подписки {localDateFromSqlite(sub.period_end)} — доступ сохранится до этой даты.
          </p>
        ) : sub.status === 'trialing' ? (
          // Subscribed during a trial: Polar holds the card and bills when the
          // trial lapses. This case MUST come before the "Renews on" fallback —
          // that date is this account's first-ever charge, and calling it a
          // renewal tells someone who has paid nothing that they already have.
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
            {sub.trial_end
              ? `Бесплатно до ${localDateFromSqlite(sub.trial_end)} — первое списание в эту дату. Отмените подписку до этого момента, и списания не будет.`
              : 'У вас пробный период — отмените подписку до его окончания, и списания не будет.'}
          </p>
        ) : sub.status === 'past_due' ? (
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
            Просрочен платёж — обновите карту, чтобы сохранить этот тариф.
          </p>
        ) : sub.period_end ? (
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
            Продление {localDateFromSqlite(sub.period_end)}.
          </p>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={busy}
          onClick={() => portal.mutate({ org_id: orgId }, { onError })}
        >
          Управление подпиской
        </Button>
      </div>
    )
  }

  // Unsubscribed → offer the purchasable (paid, listed) tiers for this account
  // kind. Includes a trial tier so a trial converts to a real subscription.
  const targets = plans.filter(
    (p) =>
      p.account_kind === usage.account_kind &&
      p.listed &&
      p.price_cents != null &&
      p.price_cents > 0,
  )
  if (targets.length === 0) return null
  // A live trial of a tier we're selling changes what these buttons MEAN. The
  // trial grants that tier already, and converting forfeits the remaining free
  // days (no trial period is passed to Polar, and the webhook clears
  // trial_ends_at), so "Upgrade to Personal" beside a "Current: Personal" badge
  // read as either broken or a scam — and the screen said "trial" nowhere,
  // because its only source was the banner, which stays quiet until day 23.
  // Say the deal out loud instead; the button is honest either way.
  const trial = usage.trial
  return (
    <div className="flex flex-col gap-[var(--space-2)] border-t border-[var(--border-subtle)] pt-[var(--space-3)]">
      {trial ? (
        <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
          {trial.ended
            ? `Пробный период тарифа ${trial.plan_name} завершился — полный доступ сохранится до ${localDateFromSqlite(trial.grace_ends_at)}.`
            : `У вас бесплатный пробный период тарифа ${trial.plan_name} до ${localDateFromSqlite(trial.ends_at)} — все возможности этого тарифа уже доступны. Оформите подписку сейчас, и оставшаяся часть периода будет бесплатной: первое списание состоится ${localDateFromSqlite(trial.ends_at)}, а отмена до этого момента ничего не стоит.`}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        {targets.map((p) => {
          // Bill yearly only when the tier actually has a yearly product; else the
          // toggle is a no-op for that tier and it stays monthly.
          const interval: BillingPeriod = period === 'year' && p.price_cents_yearly != null ? 'year' : 'month'
          // "Upgrade" is a lie for the tier you are already trialling — nothing
          // is gained. Only the wording changes; the action is the same.
          const isTrialledTier = trial != null && trial.plan_key === p.key
          return (
            <Button
              key={p.key}
              variant={isTrialledTier && !trial?.ended ? 'secondary' : 'primary'}
              size="sm"
              disabled={busy}
              onClick={() => checkout.mutate({ plan_key: p.key, org_id: orgId, interval }, { onError })}
            >
              {isTrialledTier ? 'Подписка на' : 'Перейти на'} {p.name} · {compactPrice(p, interval)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// One account's plan + usage. account identifies who to re-plan (admin only);
// canManage gates the self-serve billing controls (plans must be loaded too).
function UsageCard({
  title,
  subtitle,
  usage,
  isPending,
  isError,
  account,
  plans,
  canManage,
  period = 'month',
}: {
  title: string
  subtitle?: string
  usage: Usage | undefined
  isPending: boolean
  isError: boolean
  account?: { kind: 'user' | 'org'; id: number } | null
  plans?: Plan[]
  canManage?: boolean
  period?: BillingPeriod
}) {
  return (
    <Card className="flex flex-col gap-[var(--space-4)] p-[var(--space-5)]">
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <div className="min-w-0">
          <h3 className="m-0 font-medium text-[var(--text-primary)] truncate">{title}</h3>
          {subtitle ? (
            <p className="m-0 mt-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {usage ? (
          <Badge variant={usage.trial ? 'muted' : 'accent'} className="shrink-0">
            {usage.plan.name}
            {usage.trial ? ' · Пробный период' : ''}
          </Badge>
        ) : null}
      </div>

      {isPending ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">Загрузка использования…</p>
      ) : isError || !usage ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Не удалось загрузить данные об использовании.
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--space-4)]">
          <Metric
            icon={<Layers width={15} height={15} />}
            label="Пространства"
            used={usage.usage.spaces}
            max={usage.plan.max_spaces}
          />
          <Metric
            icon={<HardDrive width={15} height={15} />}
            label="Вложения"
            used={usage.usage.storage_bytes}
            max={usage.plan.max_storage_bytes}
            format={formatBytes}
          />
          {usage.account_kind === 'org' ? (
            <Metric
              icon={<Users width={15} height={15} />}
              label="Участники"
              used={usage.usage.members ?? 0}
              max={usage.plan.max_members}
            />
          ) : null}
          <Metric
            icon={<Sparkles width={15} height={15} />}
            label="Встроенный ИИ / мес"
            used={usage.usage.llm_calls}
            max={usage.plan.max_llm_calls_per_month}
          />
        </div>
      )}

      {canManage && usage && plans ? (
        <BillingActions usage={usage} plans={plans} period={period} />
      ) : null}

      {account && usage ? (
        <div className="flex items-center gap-[var(--space-2)] border-t border-[var(--border-subtle)] pt-[var(--space-3)]">
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
            Администратор · смена тарифа
          </span>
          <PlanTierSelect
            accountKind={account.kind}
            accountId={account.id}
            currentKey={usage.plan.key}
            className="max-w-[12rem]"
          />
        </div>
      ) : null}
    </Card>
  )
}


// Atlas indexing budget in the unit people think in. Minutes read as precision
// the estimate doesn't have; hours read as a budget.
function formatAtlasMinutes(min: number | null | undefined): string {
  if (min == null) return 'Без ограничений'
  return min >= 60 ? `${Math.round(min / 60)}h` : `${min} min`
}

// A compact spec line for a plan in the comparison grid.
function planSpecs(p: Plan): string[] {
  // Tiers are metered on AI (Atlas sources + monthly answers) and, for orgs,
  // seats — not pages/spaces (unlimited on every tier now). Storage is a quiet
  // backstop, shown as a usage line, not sold.
  const specs = [
    `${formatCount(p.max_atlas_sources)} ${ruPlural(p.max_atlas_sources ?? 0, 'источник', 'источника', 'источников')} Атласа · ${p.features?.atlas_scheduled ? 'обновление по расписанию' : 'обновление вручную'}`,
    // The indexing budget is the limit that actually binds — a source count says
    // nothing about cost, since a run ranges 5-80 minutes. Read from the plans
    // API so it cannot drift from the backend the way hardcoded copy does.
    `${formatAtlasMinutes(p.max_atlas_minutes_per_month)} индексации Атласа / мес`,
    `${formatCount(p.max_llm_calls_per_month)} ответов встроенного ИИ / мес`,
    `Без ограничений с вашим собственным агентом (MCP)`,
    `${formatStorageLimit(p.max_storage_bytes)} вложений`,
  ]
  if (p.account_kind === 'org') {
    specs.push(`${formatCount(p.max_members)} ${ruPlural(p.max_members ?? 0, 'участник', 'участника', 'участников')}`)
  }
  return specs
}

function PlanCatalog({
  plans,
  currentKey,
  trialKey,
  period,
}: {
  plans: Plan[]
  currentKey: string | undefined
  // The tier being TRIALLED, when that's why it reads as current. Without it the
  // catalog badges a trialled tier "Current" — true about access, misleading
  // about ownership, and the reason the paid button beside it looked absurd.
  trialKey?: string
  period: BillingPeriod
}) {
  const groups: { kind: 'user' | 'org'; label: string }[] = [
    { kind: 'user', label: 'Личный аккаунт' },
    { kind: 'org', label: 'Организация' },
  ]
  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      {groups.map((g) => {
        const tiers = plans.filter((p) => p.account_kind === g.kind && p.listed)
        if (tiers.length === 0) return null
        return (
          <div key={g.kind} className="flex flex-col gap-[var(--space-3)]">
            <h4 className="m-0 text-[length:var(--text-xs)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {g.label}: тарифы
            </h4>
            <div className="grid gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
              {tiers.map((p) => {
                const isCurrent = p.key === currentKey
                const isTrial = isCurrent && p.key === trialKey
                return (
                  <Card
                    key={p.key}
                    className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
                    style={
                      isCurrent
                        ? { borderColor: 'var(--accent)' }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-[var(--space-2)]">
                      <span className="font-medium text-[var(--text-primary)]">{p.name}</span>
                      {isCurrent ? (
                        <Badge variant={isTrial ? 'muted' : 'accent'}>
                          {isTrial ? 'Пробный период' : 'Текущий'}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="m-0 flex items-baseline gap-[var(--space-2)]">
                      <span className="text-[length:var(--text-xl)] font-semibold text-[var(--text-primary)]">
                        {formatPrice(priceForPeriod(p, period))}
                      </span>
                      {periodLabel(p, period) ? (
                        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
                          {periodLabel(p, period)}
                        </span>
                      ) : null}
                    </p>
                    {period === 'year' && yearlySavingsDollars(p) ? (
                      <p className="m-0 text-[length:var(--text-xs)] text-[var(--accent)]">
                        Экономия ${yearlySavingsDollars(p)}/год по сравнению с ежемесячной оплатой
                      </p>
                    ) : null}
                    <ul className="m-0 flex list-none flex-col gap-[var(--space-1)] p-0">
                      {planSpecs(p).map((s) => (
                        <li
                          key={s}
                          className="text-[length:var(--text-sm)] text-[var(--text-muted)]"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SettingsBillingTab() {
  const me = useMe()
  const orgs = useOrgs()
  const myUsage = useMyUsage()
  const plans = usePlans('billing')
  const isAdmin = me.data?.is_instance_admin ?? false
  // Honor a ?interval=year deep-link (e.g. from the landing's yearly toggle) so a
  // "Get Personal yearly" click lands here pre-set to yearly.
  const [period, setPeriod] = useState<BillingPeriod>(() =>
    new URLSearchParams(window.location.search).get('interval') === 'year' ? 'year' : 'month',
  )
  // Orgs the caller actually belongs to (instance-admins see all orgs via the
  // list, but usage cards make sense only for orgs they're a member of).
  const myOrgs = (orgs.data ?? []).filter((o) => o.my_role != null)

  // Post-checkout: Polar redirects back with ?checkout=… The plan is granted
  // asynchronously by the webhook, so refetch usage now and a couple more times
  // (covering webhook latency) and reassure the user — instead of landing them on
  // a stale "still Free / Upgrade" screen the moment after they paid.
  const qc = useQueryClient()
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get('checkout')) return
    toast({
      title: 'Платёж получен',
      description: 'Активируем ваш тариф — это может занять несколько секунд.',
    })
    const refetch = () => void qc.invalidateQueries({ queryKey: billingKeys.all })
    refetch()
    const t1 = setTimeout(refetch, 4000)
    const t2 = setTimeout(refetch, 9000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [qc])

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <header className="flex flex-col gap-[var(--space-3)]">
        <div className="flex flex-col gap-[var(--space-1)]">
          <h2 className="m-0 text-[length:var(--text-lg)] font-medium text-[var(--text-primary)]">
            Тариф и использование
          </h2>
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] max-w-[var(--measure,60ch)]">
            У вашего личного аккаунта и у каждой организации, в которой вы состоите,
            свой тариф. Лимиты применяются ко владельцу пространства.{' '}
            <a
              href={DOCS.plans}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] no-underline hover:underline"
            >
              Тарифы и оплата →
            </a>
          </p>
        </div>
        <BillingPeriodToggle value={period} onChange={setPeriod} />
      </header>

      <UsageCard
        title="Личный аккаунт"
        subtitle={me.data?.username}
        usage={myUsage.data}
        isPending={myUsage.isPending}
        isError={myUsage.isError}
        account={isAdmin && me.data ? { kind: 'user', id: me.data.id } : null}
        plans={plans.data}
        canManage
        period={period}
      />

      {myOrgs.length > 0 ? (
        <div className="flex flex-col gap-[var(--space-3)]">
          <h3 className="m-0 text-[length:var(--text-xs)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Организации
          </h3>
          <div className="flex flex-col gap-[var(--space-3)]">
            {myOrgs.map((o) => (
              <OrgUsageCard
                key={o.id}
                orgId={o.id}
                name={o.name}
                isAdmin={isAdmin}
                canManage={o.my_role === 'admin'}
                plans={plans.data}
                period={period}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Team plans run on an organization. A user with no org they admin can
          create one here (self-serve) — invite teammates and upgrade in place. */}
      {!myOrgs.some((o) => o.my_role === 'admin') ? (
        <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-[var(--space-4)]">
          <p className="m-0 text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
            Нужен тариф для команды?
          </p>
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] max-w-[var(--measure,60ch)]">
            Тарифы для команд работают через организацию. Создайте её бесплатно,
            пригласите коллег и перейдите на тариф для команды, когда будете готовы.
          </p>
          <div className="flex items-center gap-[var(--space-3)]">
            <CreateTeamDialog
              trigger={
                <Button variant="secondary" size="sm">
                  Создать команду
                </Button>
              }
            />
            <a
              href="mailto:tela@telawiki.com?subject=tela%20Team%20plan"
              className="text-[length:var(--text-sm)] text-[var(--text-muted)] no-underline hover:underline"
            >
              или напишите нам
            </a>
          </div>
        </div>
      ) : null}

      {plans.data && plans.data.length > 0 ? (
        <section className="flex flex-col gap-[var(--space-3)]">
          <h3 className="m-0 text-[length:var(--text-base)] font-medium text-[var(--text-primary)]">
            Тарифы
          </h3>
          <PlanCatalog
            plans={plans.data}
            currentKey={myUsage.data?.plan.key}
            trialKey={myUsage.data?.trial?.plan_key}
            period={period}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-[var(--space-3)]">
        <h3 className="m-0 text-[length:var(--text-xs)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          В каждый тариф входит
        </h3>
        <ul className="m-0 grid list-none grid-cols-1 gap-[var(--space-2)] p-0 sm:grid-cols-2">
          {INCLUDED.map((f) => (
            <li
              key={f}
              className="flex items-start gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-muted)]"
            >
              <Check
                width={15}
                height={15}
                aria-hidden
                className="mt-[2px] shrink-0 text-[var(--accent)]"
              />
              {f}
            </li>
          ))}
        </ul>
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Предпочитаете запустить самостоятельно? У tela открытый исходный
          код, его можно развернуть на своём сервере —{' '}
          <a
            href="https://github.com/zcag/tela"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] no-underline hover:underline"
          >
            развернуть у себя
          </a>
          .
        </p>
      </section>
    </div>
  )
}

// Split out so each org's usage query runs under hooks rules (one hook per card).
function OrgUsageCard({
  orgId,
  name,
  isAdmin,
  canManage,
  plans,
  period,
}: {
  orgId: number
  name: string
  isAdmin: boolean
  canManage: boolean
  plans: Plan[] | undefined
  period: BillingPeriod
}) {
  const usage = useOrgUsage(orgId)
  return (
    <UsageCard
      title={name}
      subtitle="Организация"
      usage={usage.data}
      isPending={usage.isPending}
      isError={usage.isError}
      account={isAdmin ? { kind: 'org', id: orgId } : null}
      plans={plans}
      canManage={canManage}
      period={period}
    />
  )
}
