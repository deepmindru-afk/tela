import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ExternalLink, Info } from 'lucide-react'
import { navigateToPage } from '../../lib/pageHitItem'
import { IncludeAdminsToggle } from './IncludeAdminsToggle'
import { useAIUsage } from '../../lib/queries/ai-usage'
import { useAIEndpoints, type AIEndpointHealth, type AIGate } from '../../lib/queries/ai-endpoints'
import {
  useAdminStats,
  type AdminStats,
  type StatsSignup,
  type StatsSignupSource,
  type StatsTopPage,
  type StatsTopPerson,
  type StatsTopSpace,
  type StatsUnanswered,
} from '../../lib/queries/admin-stats'
import { Avatar, type AvatarTone } from '../ui/avatar'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { CoverageGauge } from '../ui/coverage-gauge'
import { DayBars } from '../ui/day-bars'
import { Sparkline } from '../ui/sparkline'
import { StatusBadge } from '../ui/status-badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { relativeTimeFromSqlite } from '../../lib/relativeTime'
import { cn } from '../../lib/utils'
import { ruPlural } from '../../lib/ru-plural'

// Russian plural for counted nouns: 1 токен, 2 токена, 5 токенов.
// Settings → Insights — the instance-analytics hub (instance-admin). A scannable
// top-to-bottom read: at-a-glance KPIs → growth/signups → activity → people &
// content → AI/retrieval → knowledge health. Everything is aggregated server-side
// from the events log + existing tables; week-over-week deltas are derived here
// from the dense 30-day series. See backend admin_stats.go.

const nf = (n: number) => n.toLocaleString()
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const last7 = (a: number[]) => sum(a.slice(-7))
const prev7 = (a: number[]) => sum(a.slice(-14, -7))
// New in the trailing 7 days, read off a cumulative series.
const newInWeek = (cum: number[]) =>
  cum.length >= 8 ? cum[cum.length - 1] - cum[cum.length - 8] : (cum[cum.length - 1] ?? 0) - (cum[0] ?? 0)

export function SettingsInsightsTab() {
  // Admin activity is excluded from the aggregates by default — the operator's own
  // views/edits/asks otherwise drown the real signal. The toggle re-includes it.
  const [includeAdmins, setIncludeAdmins] = useState(false)
  const q = useAdminStats(includeAdmins)

  return (
    <TooltipProvider delayDuration={150}>
      <section aria-labelledby="settings-insights" className="flex flex-col gap-[var(--space-6)]">
        <div className="flex items-start justify-between gap-[var(--space-3)]">
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
            Срез состояния инстанса в реальном времени. Динамика — по дням
            за последние 30 дней; изменения сравнивают последние 7 дней с предыдущими семью.
          </p>
          <IncludeAdminsToggle checked={includeAdmins} onChange={setIncludeAdmins} />
        </div>
        {q.isLoading ? (
          <InsightsSkeleton />
        ) : q.isError || !q.data ? (
          <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
            Не удалось загрузить аналитику.
          </p>
        ) : (
          <InsightsBody s={q.data} />
        )}
      </section>
    </TooltipProvider>
  )
}

function InsightsBody({ s }: { s: AdminStats }) {
  const answerRate = s.asks_30 > 0 ? s.asks_answered_30 / s.asks_30 : 0
  const activation = s.users > 0 ? s.activated / s.users : 0

  return (
    <>
        {/* At a glance */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--space-3)]">
          <Kpi
            label="Активные пользователи"
            value={s.wau}
            delta={s.wau - s.wau_prev}
            deltaSuffix="к прошлой неделе"
            sub={`${nf(s.dau)} сегодня · ${nf(s.mau)} за месяц`}
            hint="Уникальные пользователи с любой активностью за последние 7 дней. Изменение сравнивается с 7 днями до этого."
          />
          <Kpi
            label="Пользователи"
            value={s.users}
            delta={newInWeek(s.users_cum)}
            deltaSuffix="за неделю"
            series={s.users_cum}
            accent
          />
          <Kpi
            label="Страницы"
            value={s.pages}
            delta={newInWeek(s.pages_cum)}
            deltaSuffix="за неделю"
            series={s.pages_cum}
            accent
          />
          <Kpi
            label="Подключённые агенты"
            value={s.mcp_users}
            sub={`${nf(s.active_pats)} активных ${ruPlural(s.active_pats, 'токен', 'токена', 'токенов')} · ${nf(s.public_spaces)} публичных`}
            hint="Пользователи, подключившие агента через MCP — основная аудитория tela. Активные токены — действующие персональные токены доступа; публичные = пространства, опубликованные в интернете."
            accent
          />
        </div>

        {/* Growth & signups */}
        <Section title="Регистрации и активация" desc="Кто присоединяется и начинает ли работать после этого.">
          <div className="grid gap-[var(--space-5)] lg:grid-cols-[auto_1fr] items-start">
            <div className="flex items-center gap-[var(--space-4)] lg:flex-col lg:items-start">
              <CoverageGauge value={activation} caption="активированы" size="md" />
              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="text-[length:var(--text-sm)] text-[var(--text-primary)]">
                  <span className="font-semibold tabular-nums">{nf(s.activated)}</span>
                  <span className="text-[var(--text-muted)]"> из {nf(s.users)}</span>
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
                  создали страницу
                </span>
                <span className="mt-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-primary)]">
                  <span className="font-semibold tabular-nums">{nf(s.new_users_30)}</span>
                  <span className="text-[var(--text-muted)]"> новых · 30 дн.</span>
                </span>
              </div>
            </div>
            <Panel title="Недавние регистрации" empty="Регистраций пока нет.">
              {s.recent_signups.map((u) => (
                <SignupRow key={u.user_id} u={u} />
              ))}
            </Panel>
          </div>
          {/* When they joined, beside where they came from. Per day, not
              cumulative: "how many joined on the 4th" is a count, and the growth
              curve only implies it. */}
          <div className="mt-[var(--space-5)] grid gap-[var(--space-4)] lg:grid-cols-[2fr_1fr] items-start">
            <div className="flex flex-col gap-[var(--space-2)]">
              <div className="flex items-baseline justify-between gap-[var(--space-3)]">
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
                  Новых аккаунтов в день · последние 30 дней
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] tabular-nums">
                  самый активный день {nf(Math.max(0, ...s.signups))} · всего {nf(sum(s.signups))}
                </span>
              </div>
              <span className="block w-full text-[var(--accent)]">
                <DayBars
                  values={s.signups}
                  labels={s.days}
                  height={56}
                  ariaLabel="Новых аккаунтов в день за последние 30 дней"
                  format={(v, d) => `${d}: ${v} ${ruPlural(v, 'регистрация', 'регистрации', 'регистраций')}`}
                />
              </span>
            </div>
            {/* Where those accounts came from. Attribution is first-touch, read
                off the landing cookie at signup, so it only exists for accounts
                created since it shipped — the caption says how many of the
                cohort it covers rather than letting the rest read as 'direct'. */}
            <Panel
              title="Источники регистраций · 30 дн."
              empty="Атрибутированных регистраций пока нет."
              note={
                s.signup_sources_known > 0
                  ? `атрибутировано ${nf(s.signup_sources_known)} из ${nf(s.new_users_30)} новых аккаунтов`
                  : undefined
              }
            >
              {s.signup_sources.map((src, i) => (
                <SignupSourceRow key={src.source} s={src} rank={i + 1} />
              ))}
            </Panel>
          </div>
        </Section>

        {/* Activity */}
        <Section title="Активность" desc="Объём по дням за 30 дней с изменением по сравнению с прошлой неделей.">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-[var(--space-3)]">
            <Trend label="Просмотры страниц" series={s.views} />
            <Trend label="Правки" series={s.edits} />
            <Trend label="Входы" series={s.logins} />
            <Trend label="Вопросы" series={s.asks} />
            <Trend label="Ошибки" series={s.errors} invert tone="danger" />
          </div>
        </Section>

        {/* People & content */}
        <Section title="Популярное содержимое и участники" desc="Самые активные страницы, авторы и пространства за 30 дней.">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-4)]">
            <Panel title="Самые просматриваемые страницы" empty="Просмотров пока нет.">
              {s.top_pages.map((p, i) => (
                <PageRow key={p.page_id} p={p} rank={i + 1} />
              ))}
            </Panel>
            <Panel title="Топ авторов" empty="Правок пока нет.">
              {s.top_contributors.map((c, i) => (
                <ContributorRow key={c.label} c={c} rank={i + 1} />
              ))}
            </Panel>
            <Panel title="Самые активные пространства" empty="Активности пока нет.">
              {s.top_spaces.map((sp, i) => (
                <SpaceRow key={sp.space_id} s={sp} rank={i + 1} />
              ))}
            </Panel>
          </div>
        </Section>

        {/* AI & retrieval */}
        <Section title="ИИ и поиск по документам" desc="Вопросы к ИИ и те запросы, на которые ваши документы не дали ответа — список задач для наполнения.">
          <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
            <span className={cn(
              'inline-flex items-center gap-[var(--space-1)] rounded-full px-[var(--space-2)] py-0.5',
              'text-[length:var(--text-xs)] font-medium',
              s.ai_healthy
                ? 'bg-[var(--accent-positive-subtle)] text-[var(--accent-positive-fg)]'
                : 'bg-[var(--accent-negative-subtle)] text-[var(--accent-negative-fg)]',
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', s.ai_healthy ? 'bg-[var(--accent-positive-fg)]' : 'bg-[var(--accent-negative-fg)]')} />
              {s.ai_healthy ? 'ИИ доступен' : 'ИИ недоступен'}
            </span>
            {!s.ai_healthy && s.ai_reason && (
              <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{s.ai_reason}</span>
            )}
          </div>
          <div className="grid gap-[var(--space-5)] lg:grid-cols-[auto_1fr] items-start">
            <div className="flex items-center gap-[var(--space-4)] lg:flex-col lg:items-start">
              <CoverageGauge value={answerRate} caption="с ответом" size="md" />
              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="text-[length:var(--text-sm)] text-[var(--text-primary)]">
                  <span className="font-semibold tabular-nums">{nf(s.asks_30)}</span>
                  <span className="text-[var(--text-muted)]"> вопросов · 30 дн.</span>
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
                  {nf(s.asks_answered_30)} с источниками
                </span>
              </div>
            </div>
            <Panel
              title="Вопросы без ответа"
              empty="На все недавние вопросы найдены ответы."
            >
              {s.unanswered_asks.map((a, i) => (
                <UnansweredRow key={i} a={a} />
              ))}
            </Panel>
          </div>
        </Section>

        <AIReliabilitySection />

        <AIUsageSection />

        {/* Knowledge health */}
        <Section title="Состояние базы знаний" desc="Показатели, которые стоит время от времени проверять.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-3)]">
            <Health label="Устаревшие страницы" value={s.stale_pages} sub="не обновлялись 90+ дн." warn={s.stale_pages > 0} />
            <Health label="Страницы-сироты" value={s.orphan_pages} sub="нет входящих ссылок" warn={s.orphan_pages > 0} />
            <Health label="Противоречия" value={s.contradictions} sub="страницы с разными версиями" warn={s.contradictions > 0} />
          </div>
        </Section>
    </>
  )
}

// --- Composition primitives -------------------------------------------------

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-[var(--space-4)]">
        <CardTitle className="text-[length:var(--text-base)]">{title}</CardTitle>
        {desc ? <CardDescription>{desc}</CardDescription> : null}
      </CardHeader>
      <CardBody className="pb-[var(--space-6)]">{children}</CardBody>
    </Card>
  )
}

function Kpi({
  label,
  value,
  sub,
  delta,
  deltaSuffix,
  deltaInvert,
  series,
  accent,
  hint,
}: {
  label: string
  value: number
  sub?: string
  delta?: number
  deltaSuffix?: string
  deltaInvert?: boolean
  series?: number[]
  accent?: boolean
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-[var(--space-4)]">
      <div className="flex items-center gap-[var(--space-1)]">
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{label}</span>
        {hint ? <Hint text={hint} /> : null}
      </div>
      <span
        className={cn(
          'text-[length:var(--text-2xl)] font-semibold tabular-nums leading-none',
          accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]',
        )}
      >
        {nf(value)}
      </span>
      {series && series.length > 1 ? (
        <span className="block w-full text-[var(--accent)]">
          <Sparkline values={series} height={30} ariaLabel={`Динамика: ${label}`} />
        </span>
      ) : null}
      <div className="flex items-center justify-between gap-[var(--space-2)] min-h-[var(--space-4)]">
        {delta !== undefined ? <Delta value={delta} invert={deltaInvert} suffix={deltaSuffix} /> : <span />}
        {sub ? <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] truncate">{sub}</span> : null}
      </div>
    </div>
  )
}

function Trend({ label, series, invert, tone = 'accent' }: { label: string; series: number[]; invert?: boolean; tone?: 'accent' | 'danger' }) {
  const total = sum(series)
  const d = last7(series) - prev7(series)
  return (
    <div className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)]">
      <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{label}</span>
      <span className="text-[length:var(--text-lg)] font-semibold tabular-nums leading-none text-[var(--text-primary)]">
        {nf(total)}
      </span>
      <span className={cn('block w-full', tone === 'danger' && total > 0 ? 'text-[var(--danger)]' : 'text-[var(--accent)]')}>
        <Sparkline values={series} height={26} ariaLabel={`Динамика: ${label}`} />
      </span>
      <Delta value={d} invert={invert} />
    </div>
  )
}

function Delta({ value, invert, suffix }: { value: number; invert?: boolean; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
        без изменений{suffix ? ` ${suffix}` : ''}
      </span>
    )
  }
  const good = invert ? value < 0 : value > 0
  const Arrow = value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[1px] text-[length:var(--text-xs)] font-medium tabular-nums',
        good ? 'text-[var(--accent-positive-fg)]' : 'text-[var(--accent-negative-fg)]',
      )}
    >
      <Arrow width={12} height={12} aria-hidden="true" />
      {value > 0 ? '+' : ''}
      {nf(value)}
      {suffix ? <span className="text-[var(--text-muted)] font-normal"> {suffix}</span> : null}
    </span>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Что это значит?"
          className="inline-flex text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <Info width={12} height={12} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[18rem]">{text}</TooltipContent>
    </Tooltip>
  )
}

// `note` is an optional caption under the title — for a panel whose numbers
// need a denominator to be read honestly.
function Panel({ title, empty, note, children }: { title: string; empty: string; note?: string; children: React.ReactNode[] }) {
  return (
    <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)]">
      <span className="text-[length:var(--text-xs)] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </span>
      {note ? (
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{note}</span>
      ) : null}
      {children.length > 0 ? (
        <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-2)]">{children}</ul>
      ) : (
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{empty}</span>
      )}
    </div>
  )
}

function Health({ label, value, sub, warn }: { label: string; value: number; sub: string; warn: boolean }) {
  return (
    <div className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)]">
      <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{label}</span>
      <span className={cn('text-[length:var(--text-xl)] font-semibold tabular-nums leading-none', warn ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]')}>
        {nf(value)}
      </span>
      <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{sub}</span>
    </div>
  )
}

// --- Row renderers ----------------------------------------------------------

const AVATAR_TONES: AvatarTone[] = [
  'collab-1', 'collab-2', 'collab-3', 'collab-4', 'collab-5', 'collab-6', 'collab-7', 'collab-8',
]
function avatarTone(name: string): AvatarTone {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const s = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  return s.toUpperCase() || name.slice(0, 1).toUpperCase() || '?'
}

function Rank({ n }: { n: number }) {
  return <span className="w-[var(--space-4)] shrink-0 text-[length:var(--text-xs)] tabular-nums text-[var(--text-muted)]">{n}</span>
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 tabular-nums text-[length:var(--text-xs)] text-[var(--text-muted)]">{children}</span>
}

function PageRow({ p, rank }: { p: StatsTopPage; rank: number }) {
  return (
    <li className="flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)]">
      <Rank n={rank} />
      <button
        type="button"
        onClick={() => navigateToPage(p.space_id, p.page_id)}
        className="reader-meta-link min-w-0 flex-1 truncate text-left"
      >
        {p.title} <span className="text-[var(--text-muted)]">· {p.space_name}</span>
      </button>
      <Count>{nf(p.count)}</Count>
    </li>
  )
}

function ContributorRow({ c, rank }: { c: StatsTopPerson; rank: number }) {
  return (
    <li className="flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)]">
      <Rank n={rank} />
      <Avatar size="sm" tone={avatarTone(c.label)}>{initials(c.label)}</Avatar>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{c.label}</span>
      <Count>{nf(c.count)} правок</Count>
    </li>
  )
}

function SpaceRow({ s, rank }: { s: StatsTopSpace; rank: number }) {
  return (
    <li className="flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)]">
      <Rank n={rank} />
      <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{s.name}</span>
      <Count>{nf(s.count)}</Count>
    </li>
  )
}

function SignupSourceRow({ s, rank }: { s: StatsSignupSource; rank: number }) {
  return (
    <li className="flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)]">
      <Rank n={rank} />
      <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]" title={s.source}>{s.source}</span>
      <Count>{nf(s.count)}</Count>
    </li>
  )
}

function SignupRow({ u }: { u: StatsSignup }) {
  const name = u.display_name || u.username
  return (
    <li className="flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)]">
      <Avatar size="sm" tone={avatarTone(name)}>{initials(name)}</Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[var(--text-primary)]">{name}</div>
        {u.email ? <div className="truncate text-[length:var(--text-xs)] text-[var(--text-muted)]">{u.email}</div> : null}
      </div>
      <StatusBadge tone={u.activated ? 'positive' : 'neutral'}>
        {u.activated ? 'активен' : 'без активности'}
      </StatusBadge>
      <Count>{relativeTimeFromSqlite(u.created_at)}</Count>
    </li>
  )
}

function UnansweredRow({ a }: { a: StatsUnanswered }) {
  return (
    <li className="flex flex-col gap-[1px] text-[length:var(--text-sm)]">
      <span className="text-[var(--text-primary)]">{a.question}</span>
      <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
        {a.who ? `${a.who} · ` : ''}
        {relativeTimeFromSqlite(a.created_at)}
      </span>
    </li>
  )
}

// --- AI endpoints & reliability — per-service health + relief topology -------

function AIReliabilitySection() {
  const q = useAIEndpoints()
  if (q.isLoading || q.isError || !q.data) return null
  const d = q.data
  const configured = d.services.filter((s) => s.configured)
  if (configured.length === 0) {
    return (
      <Section
        title="ИИ-эндпоинты и надёжность"
        desc="Служебные модельные сервисы и их доступность."
      >
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          ИИ-сервисы не настроены. Задайте <code>TELA_LLM_URL</code> и{' '}
          <code>TELA_RAG_EMBED_URL</code>, чтобы включить чат и эмбеддинги, —
          укажите в них резервный прокси (LiteLLM) для автоматического переключения при перегрузке эндпоинта.
        </p>
      </Section>
    )
  }
  return (
    <Section
      title="ИИ-эндпоинты и надёжность"
      desc="Текущая доступность каждого модельного сервиса. Пропустите их через резервный прокси (LiteLLM), чтобы трафик автоматически переключался при перегрузке эндпоинта."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-3)]">
        {configured.map((s) => (
          <EndpointCard key={s.service} s={s} probed={d.probed} relief={d.relief_proxy} />
        ))}
      </div>
      {d.gate ? <GateStrip g={d.gate} /> : null}
      {d.grafana_url ? (
        <a
          href={d.grafana_url}
          target="_blank"
          rel="noreferrer"
          className="reader-meta-link mt-[var(--space-3)] inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-sm)]"
        >
          Переключение и детали по каждому эндпоинту в Grafana
          <ExternalLink width={13} height={13} aria-hidden="true" />
        </a>
      ) : null}
    </Section>
  )
}

function EndpointCard({ s, probed, relief }: { s: AIEndpointHealth; probed: boolean; relief: boolean }) {
  const label = s.service === 'embed' ? 'Эмбеддинги' : 'Чат и генерация'
  const tone = !probed ? 'neutral' : s.healthy ? 'positive' : 'negative'
  const statusText = !probed ? 'Проверка…' : s.healthy ? 'Доступен' : 'Недоступен'
  return (
    <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)]">
      <div className="flex items-center justify-between gap-[var(--space-2)]">
        <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">{label}</span>
        <StatusBadge tone={tone} dot>
          {statusText}
        </StatusBadge>
      </div>
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <span className="min-w-0 truncate text-[length:var(--text-xs)] text-[var(--text-muted)]" title={s.endpoint}>
          {s.endpoint || '—'}
        </span>
        {relief ? (
          <StatusBadge tone="info">резервный пул</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">единственный эндпоинт</StatusBadge>
        )}
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-[var(--space-3)] gap-y-[var(--space-1)]">
        <EndpointField label="Модель" value={s.model || '(по умолчанию)'} />
        <EndpointField label="Задержка проверки" value={probed ? `${s.latency_ms} мс` : '—'} />
        <EndpointField
          label={s.healthy ? 'Работает' : 'Не работает'}
          value={s.since ? relativeTimeFromSqlite(s.since) : '—'}
        />
        <EndpointField label="Последняя доступность" value={s.last_ok ? relativeTimeFromSqlite(s.last_ok) : 'никогда'} />
      </dl>
      {probed && !s.healthy && s.reason ? (
        <p className="m-0 text-[length:var(--text-xs)] text-[var(--danger)] break-words">{s.reason}</p>
      ) : null}
    </div>
  )
}

// GateStrip — the foreground (ask/assist) concurrency gate: the cap before an
// overloaded primary spills to the relief layer, the live in-flight count, and
// how often it has spilled. Down-failover volume is NOT here (LiteLLM owns that —
// see the Grafana link); this is purely the overload gate.
function GateStrip({ g }: { g: AIGate }) {
  return (
    <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)]">
      <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
        Ограничение параллельных запросов
      </span>
      <dl className="m-0 grid grid-cols-3 gap-x-[var(--space-3)] gap-y-[var(--space-1)]">
        <EndpointField label="Лимит" value={String(g.limit)} />
        <EndpointField label="В работе" value={String(g.in_flight)} />
        <EndpointField
          label="Перешло в резерв"
          value={g.overflow ? g.spills.toLocaleString() : 'резерва нет'}
        />
      </dl>
      <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
        {g.overflow
          ? 'Лимит запросов (ask/assist) на основном сервисе; при переполнении избыток уходит в резервный слой.'
          : 'Лимит запросов (ask/assist) на основном сервисе; без резерва переполнение складывается в очередь, а не переключается.'}
      </p>
    </div>
  )
}

function EndpointField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[1px] min-w-0">
      <dt className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{label}</dt>
      <dd className="m-0 truncate text-[length:var(--text-sm)] tabular-nums text-[var(--text-primary)]" title={value}>
        {value}
      </dd>
    </div>
  )
}

// --- AI usage (token volume) — loads independently of the main stats query --

function AIUsageSection() {
  const q = useAIUsage()
  if (q.isLoading || q.isError || !q.data) return null
  const { weeks, models } = q.data
  if (weeks.length === 0 && models.length === 0) {
    return (
      <Section title="Использование ИИ · объём токенов">
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Использование ИИ пока не зафиксировано — оно накапливается по мере выполнения запросов в чат, эмбеддинги и генерацию изображений.
        </p>
      </Section>
    )
  }
  return (
    <Section title="Использование ИИ · объём токенов (оценка)" desc="Примените к этим данным прайс-лист провайдера, чтобы оценить стоимость (~4 символа на токен).">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)] overflow-x-auto">
          <span className="text-[length:var(--text-xs)] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            По неделям
          </span>
          <table className="w-full text-[length:var(--text-sm)] tabular-nums">
            <thead>
              <tr className="text-[var(--text-muted)] text-left text-[length:var(--text-xs)]">
                <th className="font-medium pr-[var(--space-3)]">Неделя</th>
                <th className="font-medium pr-[var(--space-3)] text-right">Токены чата</th>
                <th className="font-medium pr-[var(--space-3)] text-right">Токены эмбеддингов</th>
                <th className="font-medium text-right">Изображения</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week} className="text-[var(--text-primary)]">
                  <td className="pr-[var(--space-3)] text-[var(--text-muted)]">{w.week}</td>
                  <td className="pr-[var(--space-3)] text-right">{w.chat_tokens.toLocaleString()}</td>
                  <td className="pr-[var(--space-3)] text-right">{w.embed_tokens.toLocaleString()}</td>
                  <td className="text-right">{w.images.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)]">
          <span className="text-[length:var(--text-xs)] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            По моделям (12 недель)
          </span>
          <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
            {models.map((m) => (
              <li
                key={`${m.model}:${m.kind}`}
                className="flex items-baseline justify-between gap-[var(--space-2)] text-[length:var(--text-sm)]"
              >
                <span className="min-w-0 truncate text-[var(--text-primary)]">
                  <span className="font-medium">{m.model || '(по умолчанию)'}</span>{' '}
                  <span className="text-[var(--text-muted)]">· {m.kind} · {m.calls.toLocaleString()} вызовов</span>
                </span>
                <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                  {(m.kind === 'image' ? m.units : m.tokens).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}

// --- Loading skeleton -------------------------------------------------------

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка аналитики…</span>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--space-3)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[calc(var(--space-8)*2)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] motion-safe:animate-pulse"
          />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-[calc(var(--space-8)*3)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] motion-safe:animate-pulse"
        />
      ))}
    </div>
  )
}
