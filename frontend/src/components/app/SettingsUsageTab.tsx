import { useState } from 'react'
import { ApiError } from '../../lib/api'
import { useAdminUsage } from '../../lib/queries/admin-usage'
import { useSpaces } from '../../lib/queries/spaces'
import { useCreatePage } from '../../lib/queries/pages'
import { navigateToPage } from '../../lib/pageHitItem'
import { formatBytes } from '../../lib/format'
import type { AdminAccountUsage, AdminUsage, KnowledgeGap } from '../../lib/types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { cn } from '../../lib/utils'

// Instance-admin global usage overview: instance-wide totals, the top AI consumers
// this month, and the questions the docs keep failing to answer.
export function SettingsUsageTab() {
  const q = useAdminUsage()

  if (q.isLoading) {
    return <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">Загрузка использования…</p>
  }
  if (q.isError || !q.data) {
    return (
      <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
        Не удалось загрузить данные об использовании.
      </p>
    )
  }
  const d: AdminUsage = q.data
  const answerRate = d.totals.asks > 0 ? Math.round((d.totals.asks_answered / d.totals.asks) * 100) : null

  return (
    <section aria-labelledby="settings-usage" className="flex flex-col gap-[var(--space-5)]">
      <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
        Использование по всему инстансу. Месячные показатели приведены за{' '}
        <span className="text-[var(--text-primary)]">{d.period}</span> (UTC).
      </p>

      <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
        <Stat label="Пользователи" value={d.totals.users} />
        <Stat label="Организации" value={d.totals.orgs} />
        <Stat label="Пространства" value={d.totals.spaces} />
        <Stat label="Страницы" value={d.totals.pages} />
        <Stat label="Вложения" value={formatBytes(d.totals.storage_bytes)} />
        <Stat label="Вызовы ИИ / мес" value={d.totals.llm_calls} />
        <Stat label="Вопросы / мес" value={d.totals.asks} />
        <Stat label="Доля ответов" value={answerRate == null ? '—' : `${answerRate}%`} />
      </div>

      <div className="flex flex-col gap-[var(--space-3)]">
        <h3 className="m-0 text-[length:var(--text-sm)] font-semibold text-[var(--text-primary)]">
          Кто больше всех использует ИИ в этом месяце
        </h3>
        {d.top.length > 0 ? (
          <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
            {d.top.map((a) => (
              <ConsumerRow key={`${a.kind}-${a.id}`} a={a} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">В этом месяце ИИ не использовался.</p>
        )}
      </div>

      <div className="flex flex-col gap-[var(--space-3)]">
        <h3 className="m-0 text-[length:var(--text-sm)] font-semibold text-[var(--text-primary)]">
          Популярные вопросы без ответа (30 дн.)
        </h3>
        {d.gaps.length > 0 ? (
          <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
            {d.gaps.map((g, i) => (
              <GapRow key={i} g={g} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            Данных пока нет — для аналитики по вопросам нужен эмбеддер и сами вопросы.
          </p>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-[2px] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-[var(--space-3)] py-[var(--space-2)]">
      <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
        {label}
      </span>
      <span className="text-[length:var(--text-lg)] font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  )
}

const rowCn = cn(
  'm-0 list-none flex items-center gap-[var(--space-3)]',
  'px-[var(--space-3)] py-[var(--space-2)]',
  'rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)]',
)

function ConsumerRow({ a }: { a: AdminAccountUsage }) {
  const cap = a.llm_cap == null ? '∞' : a.llm_cap
  const over = a.llm_cap != null && a.llm_calls >= a.llm_cap
  return (
    <li className={rowCn}>
      <Badge variant="muted">{a.kind}</Badge>
      <span className="flex-1 min-w-0 truncate text-[length:var(--text-sm)] text-[var(--text-primary)]">
        {a.label}
        {a.plan_name ? (
          <span className="ml-[var(--space-2)] text-[length:var(--text-xs)] text-[var(--text-muted)]">{a.plan_name}</span>
        ) : null}
      </span>
      <span
        className={cn(
          'text-[length:var(--text-sm)] tabular-nums',
          over ? 'text-[var(--danger)] font-medium' : 'text-[var(--text-primary)]',
        )}
      >
        {a.llm_calls} / {cap}
      </span>
    </li>
  )
}

function GapRow({ g }: { g: KnowledgeGap }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={rowCn}>
      <span className="flex-1 min-w-0 truncate text-[length:var(--text-sm)] text-[var(--text-primary)]">
        {g.question}
      </span>
      <span className="shrink-0 text-[length:var(--text-xs)] text-[var(--text-muted)] tabular-nums">
        {/* `grounded`, not `answered` — retrieval nearly always returns SOMETHING,
            so "3/3 answered" on a question in this list reads as a contradiction. */}
        спрошено {g.asks}× · {g.grounded > 0 ? `${g.grounded}/${g.asks} с ответом` : 'ни разу с ответом'}
      </span>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        Создать черновик страницы
      </Button>
      <DraftGapDialog question={g.question} open={open} onOpenChange={setOpen} />
    </li>
  )
}

const GAP_STUB =
  '> [!NOTE]\n> Drafted to answer a question the docs kept failing to cover. Replace this note with the answer.\n'

// Turn an unanswered question into a page: pick a space, tweak the title, create,
// and jump straight into the new page to write the answer.
function DraftGapDialog({
  question,
  open,
  onOpenChange,
}: {
  question: string
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const spaces = useSpaces()
  const create = useCreatePage()
  const [title, setTitle] = useState(question)
  const [spaceId, setSpaceId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const opts = spaces.data ?? []
  const effective = spaceId || (opts[0] ? String(opts[0].id) : '')

  async function handleCreate() {
    const sid = Number(effective)
    if (!sid) {
      setError('Выберите пространство.')
      return
    }
    setError(null)
    try {
      const page = await create.mutateAsync({ space_id: sid, title: title.trim() || question, body: GAP_STUB })
      onOpenChange(false)
      navigateToPage(sid, page.id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось создать страницу.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Черновик страницы</DialogTitle>
          <DialogDescription>
            Создайте страницу с ответом на этот вопрос — она откроется в редакторе,
            где можно будет написать ответ.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-[var(--space-3)]">
          <div className="flex flex-col gap-[var(--space-1)]">
            <label className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)]">Заголовок</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Заголовок страницы" />
          </div>
          <div className="flex flex-col gap-[var(--space-1)]">
            <label className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)]">Пространство</label>
            <Select value={effective} onChange={(e) => setSpaceId(e.target.value)} aria-label="Пространство">
              {opts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          {error ? (
            <p role="alert" className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Отмена
            </Button>
          </DialogClose>
          <Button type="button" onClick={() => void handleCreate()} disabled={create.isPending || opts.length === 0}>
            {create.isPending ? 'Создание…' : 'Создать страницу'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
