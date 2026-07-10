import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, Check, CircleDashed, FileText, Loader2, X } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '../../ui/card'
import { StatusBadge } from '../../ui/status-badge'
import { CoverageGauge } from '../../ui/coverage-gauge'
import { Progress } from '../../ui/progress'
import { EmptyState } from '../../ui/empty-state'
import {
  type AtlasRun,
  coverageRate,
  mustCoverRate,
  useAtlasRun,
  useAtlasRunStream,
  useAtlasSourceRuns,
} from '../../../lib/queries/atlas'
import {
  ATLAS_STAGES,
  baselineFromRuns,
  computeRunProgress,
  fmtDuration,
  fmtEta,
  fmtNum,
  fmtRelative,
  runLabel,
  runTone,
  type StageProgress,
} from './atlas-lib'

// A 1s ticker so elapsed time + ETAs advance live while a run is in flight.
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export function AtlasRun() {
  const { runId } = useParams({ from: '/_app/atlas/runs/$runId' })
  const runQ = useAtlasRun(runId)
  const run = runQ.data?.run
  const projectId = runQ.data?.project_id
  const live = run?.status === 'running' || run?.status === 'pending'

  // The stream drives the pipeline. The backend replays the full persisted event
  // log on connect (even for a finished run) then sends the terminal marker, so
  // leaving it always-enabled means completed runs still show per-stage durations
  // + the log; a live run keeps streaming. On the end marker we refetch the run
  // for its final coverage/stats.
  const { events } = useAtlasRunStream(runId, {
    onEnd: () => void runQ.refetch(),
  })
  // Past runs of the same source give the ETA baseline (a typical duration).
  const sourceRunsQ = useAtlasSourceRuns(run?.source_id)
  const baseline = baselineFromRuns(sourceRunsQ.data?.runs?.filter((r) => r.id !== runId))

  const now = useNow(!!live)
  const prog = computeRunProgress(run, events, baseline, now)

  if (runQ.isLoading) {
    return (
      <Shell>
        <p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Загрузка запуска…</p>
      </Shell>
    )
  }
  if (!run) {
    return (
      <Shell>
        <EmptyState icon={FileText} title="Запуск не найден" description="Этот запуск не существует или у вас нет доступа." />
      </Shell>
    )
  }

  const failedIdx = prog.stages.findIndex((s) => s.state === 'failed')

  return (
    <Shell>
      {projectId ? (
        <Link to="/atlas/projects/$projectId" params={{ projectId }} className="mb-[var(--space-2)] inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="size-[var(--space-3)]" /> Назад к проекту
        </Link>
      ) : (
        <Link to="/atlas" className="mb-[var(--space-2)] inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="size-[var(--space-3)]" /> Атлас
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-2xl)] font-semibold text-[var(--text-primary)]">Запуск #{run.id}</h1>
        <StatusBadge tone={runTone(run.status)} dot={run.status === 'running'}>{runLabel(run.status)}</StatusBadge>
        <span className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-[var(--space-2)] py-[1px] text-[length:var(--text-xs)] font-[family-name:var(--font-mono)] text-[var(--text-muted)]">{run.kind}</span>
      </div>

      <p className="mt-[var(--space-2)] flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
        <span>начат {fmtRelative(run.started_at, now)}</span>
        <Dot />
        <span>
          {run.status === 'running' ? 'прошло ' : 'заняло '}
          <b className="font-[family-name:var(--font-mono)] text-[var(--text-primary)]">{fmtDuration(prog.elapsedSec)}</b>
        </span>
        {run.stats && (
          <>
            <Dot />
            <span className="font-[family-name:var(--font-mono)]">{run.stats.chat_model} + {run.stats.embed_model}</span>
          </>
        )}
        {run.kind === 'delta' && run.changeset && (
          <>
            <Dot />
            <span>{run.changeset.added?.length ?? 0}+ {run.changeset.modified?.length ?? 0}~ {run.changeset.deleted?.length ?? 0}−</span>
          </>
        )}
      </p>

      {run.status === 'pending' && (
        <Card className="mt-[var(--space-4)]">
          <CardBody className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-primary)]">В очереди.</span> Запуски выполняются по очереди, чтобы генерация не перегружала общую модель, используемую также для поиска и вопросов — этот запуск начнётся автоматически, когда завершится предыдущий.
          </CardBody>
        </Card>
      )}

      {run.status === 'running' && (
        <Card className="mt-[var(--space-4)]">
          <CardBody className="flex flex-col gap-[var(--space-2)]">
            <div className="flex items-center justify-between text-[length:var(--text-sm)]">
              <span className="font-medium text-[var(--text-primary)]">
                {prog.currentIndex >= 0 ? `${ATLAS_STAGES[prog.currentIndex].label} · этап ${prog.currentIndex + 1}/12` : 'Запуск…'}
              </span>
              <span className="text-[var(--text-muted)]">
                {Math.round(prog.overallProgress * 100)}%{prog.etaSec != null ? ` · ${fmtEta(prog.etaSec)}` : ''}
              </span>
            </div>
            <Progress value={prog.overallProgress * 100} max={100} tone="neutral" />
          </CardBody>
        </Card>
      )}

      {run.status === 'failed' && run.err && (
        <div className="mt-[var(--space-4)] flex items-start gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--accent-negative-soft)] p-[var(--space-3)] text-[length:var(--text-sm)] text-[var(--accent-negative-fg)]">
          <AlertCircle className="mt-[2px] size-[var(--space-4)] shrink-0" />
          <span><b>Ошибка на {ATLAS_STAGES[failedIdx]?.label ?? run.stage}.</b> {run.err}</span>
        </div>
      )}

      <div className="mt-[var(--space-4)] grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Конвейер · {prog.doneCount}/12 этапов</CardTitle></CardHeader>
          <CardBody>
            <ol className="flex flex-col">
              {prog.stages.map((s, i) => <StageRow key={s.def.key} s={s} last={i === prog.stages.length - 1} />)}
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Живой лог</CardTitle></CardHeader>
          <CardBody><RunLog events={events} terminal={run.status === 'done' || run.status === 'failed' || run.status === 'canceled'} /></CardBody>
        </Card>
      </div>

      {run.coverage && <CoverageCard run={run} />}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[68rem] px-[var(--space-5)] py-[var(--space-5)]">{children}</div>
}

function Dot() {
  return <span className="inline-block size-[3px] rounded-full bg-[var(--border-strong)]" />
}

function StageRow({ s, last }: { s: StageProgress; last: boolean }) {
  const running = s.state === 'running'
  return (
    <li className="relative grid grid-cols-[var(--space-6)_1fr_auto] items-start gap-x-[var(--space-3)] py-[var(--space-2)]">
      {!last && (
        <span className={['absolute left-[calc(var(--space-6)/2-1px)] top-[var(--space-7)] bottom-0 w-[2px]', s.state === 'done' ? 'bg-[var(--accent-positive-soft)]' : 'bg-[var(--border-subtle)]'].join(' ')} />
      )}
      <span
        className={[
          'relative z-[1] grid size-[var(--space-6)] place-items-center rounded-full border',
          s.state === 'done'
            ? 'border-[var(--accent-positive-fg)] bg-[var(--accent-positive-soft)] text-[var(--accent-positive-fg)]'
            : s.state === 'failed'
              ? 'border-[var(--accent-negative-fg)] bg-[var(--accent-negative-soft)] text-[var(--accent-negative-fg)]'
              : running
                ? 'border-[var(--accent-info-fg)] bg-[var(--accent-info-soft)] text-[var(--accent-info-fg)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-muted)]',
        ].join(' ')}
      >
        {s.state === 'done' ? <Check className="size-[var(--space-3)]" strokeWidth={3} />
          : s.state === 'failed' ? <X className="size-[var(--space-3)]" strokeWidth={3} />
          : running ? <Loader2 className="size-[var(--space-3)] motion-safe:animate-spin" />
          : <CircleDashed className="size-[var(--space-3)]" />}
      </span>
      <div className="min-w-0">
        <div className={['text-[length:var(--text-sm)] font-medium', s.state === 'pending' ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'].join(' ')}>{s.def.label}</div>
        <div className="truncate text-[length:var(--text-xs)] text-[var(--text-muted)]">{running && s.lastMsg ? s.lastMsg : s.def.desc}</div>
        {running && s.total > 0 && (
          <div className="mt-[var(--space-2)] max-w-[20rem]"><Progress value={s.cur} max={s.total} tone="neutral" /></div>
        )}
      </div>
      <div className="whitespace-nowrap pt-[2px] text-right text-[length:var(--text-xs)] font-[family-name:var(--font-mono)] text-[var(--text-muted)]">
        {running ? (
          <>
            {s.total > 0 && <div>{fmtNum(s.cur)} / {fmtNum(s.total)}</div>}
            {s.etaSec != null && <div className="text-[var(--accent-info-fg)]">{fmtEta(s.etaSec)}</div>}
          </>
        ) : s.state === 'done' && s.durationSec != null ? fmtDuration(s.durationSec) : ''}
      </div>
    </li>
  )
}

function RunLog({ events, terminal }: { events: { stage: string; msg: string; level: string }[]; terminal?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [events.length])
  if (events.length === 0) {
    return (
      <p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
        {terminal ? 'Живой лог для этого запуска не сохранён.' : 'Ожидание запуска…'}
      </p>
    )
  }
  return (
    <div ref={ref} className="max-h-[26rem] overflow-auto rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-[var(--space-3)]">
      <ul className="flex flex-col gap-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] leading-[var(--leading-tight)]">
        {events.slice(-300).map((e, i) => (
          <li key={i} className={e.level === 'error' ? 'text-[var(--accent-negative-fg)]' : e.level === 'warn' ? 'text-[var(--accent-warning-fg)]' : 'text-[var(--text-muted)]'}>
            <span className="text-[var(--text-primary)]">{e.stage}</span> {e.msg}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CoverageCard({ run }: { run: AtlasRun }) {
  const cov = run.coverage!
  const stats = run.stats
  return (
    <Card className="mt-[var(--space-4)]">
      <CardHeader><CardTitle>Покрытие и результаты</CardTitle></CardHeader>
      <CardBody className="flex flex-col gap-[var(--space-5)]">
        <div className="flex flex-wrap items-center gap-[var(--space-6)]">
          <CoverageGauge value={mustCoverRate(cov)} caption="обяз.покрытие" />
          <CoverageGauge value={coverageRate(cov)} caption="поверхность" />
          <dl className="grid grid-cols-2 gap-x-[var(--space-6)] gap-y-[var(--space-2)] text-[length:var(--text-sm)]">
            <Stat label="Покрытая поверхность" value={`${cov.covered}/${cov.total}`} />
            <Stat label="Обязательное покрытие" value={`${cov.must_covered}/${cov.must_total}`} />
            <Stat label="Цитаты" value={`${fmtNum(cov.citations)}${cov.bad_citations ? ` · ${cov.bad_citations} нераспознано` : ''}`} />
            <Stat label="Диаграммы" value={`${cov.mermaid}${cov.mermaid_invalid ? ` · ${cov.mermaid_invalid} некорректно` : ''}`} />
            {stats && <Stat label="Страницы" value={fmtNum(stats.pages)} />}
            {stats && <Stat label="Файлы · чанки" value={`${fmtNum(stats.files)} · ${fmtNum(stats.chunks)}`} />}
            {stats && <Stat label="Токены" value={`${fmtNum(stats.usage.prompt_tokens + stats.usage.completion_tokens)} чат`} />}
            {stats && <Stat label="Длительность" value={fmtDuration(stats.duration_sec)} />}
          </dl>
        </div>
        {cov.gaps.length > 0 && (
          <details className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-[var(--space-3)]">
            <summary className="cursor-pointer text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">Не задокументированная поверхность · {cov.gaps.length}</summary>
            <ul className="mt-[var(--space-2)] flex flex-col gap-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--text-muted)]">
              {cov.gaps.slice(0, 100).map((g, i) => (
                <li key={i}>
                  <span className="text-[var(--accent-warning-fg)]">{g.kind}</span> {g.name}
                  {g.file ? <span className="opacity-70"> — {g.file}:{g.line}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardBody>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-[var(--space-4)]">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right font-[family-name:var(--font-mono)] text-[var(--text-primary)]">{value}</dd>
    </div>
  )
}
