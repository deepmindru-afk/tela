import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  AlertCircle,
  FileText,
  GitBranch,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '../../ui/button'
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from '../../ui/card'
import { Field } from '../../ui/field'
import { Input } from '../../ui/input'
import { EmptyState } from '../../ui/empty-state'
import { Progress } from '../../ui/progress'
import { StatusBadge, type StatusBadgeProps } from '../../ui/status-badge'
import { CoverageGauge } from '../../ui/coverage-gauge'
import {
  type AtlasRun,
  type AtlasRunStatus,
  type AtlasSource,
  coverageRate,
  mustCoverRate,
  useAtlasRun,
  useAtlasRunStream,
  useAtlasSources,
  useCreateAtlasSource,
  useDeleteAtlasSource,
  useStartAtlasRun,
} from '../../../lib/queries/atlas'

type Tone = NonNullable<StatusBadgeProps['tone']>

function statusTone(s?: AtlasRunStatus): Tone {
  switch (s) {
    case 'running':
      return 'running'
    case 'done':
      return 'positive'
    case 'failed':
      return 'negative'
    case 'canceled':
      return 'neutral'
    default:
      return 'info' // pending
  }
}

// repoLabel renders a git URL/path compactly (host/owner/repo → owner/repo).
function repoLabel(loc: string): string {
  const trimmed = loc.replace(/\.git$/, '').replace(/\/+$/, '')
  const parts = trimmed.split(/[/:]/).filter(Boolean)
  return parts.slice(-2).join('/') || trimmed
}

export function AtlasConsole() {
  const { spaceId } = useParams({ from: '/_app/spaces/$spaceId/atlas' })
  const sourcesQ = useAtlasSources(spaceId)
  const [selectedSource, setSelectedSource] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  const sources = sourcesQ.data?.sources ?? []
  const canManage = sourcesQ.data?.can_manage ?? false
  const managed = sourcesQ.data?.managed ?? false

  // Default the selection to the first source once loaded.
  const selected =
    sources.find((s) => s.id === selectedSource) ?? sources[0] ?? null

  return (
    <div className="mx-auto w-full max-w-[var(--content-max,72rem)] px-[var(--space-5)] py-[var(--space-5)]">
      <header className="mb-[var(--space-5)] flex items-center justify-between gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <h1 className="text-[length:var(--text-2xl)] font-semibold text-[var(--text-primary)]">
            Generation
          </h1>
          {managed && <StatusBadge tone="info">atlas-managed</StatusBadge>}
        </div>
        {managed && canManage && !adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-[var(--space-4)]" /> Add source
          </Button>
        )}
      </header>

      {sourcesQ.isLoading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Loading…</p>
      ) : adding || (!managed && canManage) ? (
        <AddSourceForm
          spaceId={spaceId}
          onClose={() => setAdding(false)}
          showCancel={managed}
        />
      ) : !managed ? (
        <EmptyState
          icon={FileText}
          title="Not a generated space"
          description="This space has no source attached. An owner or org admin can point it at a git repository to generate coverage-audited documentation here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-5)] lg:grid-cols-[20rem_1fr]">
          <aside className="flex flex-col gap-[var(--space-2)]">
            {sources.map((src) => (
              <SourceCard
                key={src.id}
                source={src}
                spaceId={spaceId}
                canManage={canManage}
                selected={selected?.id === src.id}
                onSelect={() => setSelectedSource(src.id)}
              />
            ))}
          </aside>
          <section>
            {selected ? (
              <SourceDetail source={selected} canManage={canManage} spaceId={spaceId} />
            ) : (
              <EmptyState icon={FileText} title="Select a source" />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function AddSourceForm({
  spaceId,
  onClose,
  showCancel,
}: {
  spaceId: number
  onClose: () => void
  showCancel: boolean
}) {
  const create = useCreateAtlasSource(spaceId)
  const [location, setLocation] = useState('')
  const [name, setName] = useState('')
  const [branch, setBranch] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!location.trim()) return
    try {
      await create.mutateAsync({
        location: location.trim(),
        name: name.trim() || undefined,
        branch: branch.trim() || undefined,
      })
      onClose()
    } catch {
      /* error surfaced below */
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a git source</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="flex flex-col gap-[var(--space-3)]">
          <Field label="Repository URL or path" htmlFor="atlas-loc">
            <Input
              id="atlas-loc"
              placeholder="https://github.com/owner/repo.git"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <Field label="Name (optional)" htmlFor="atlas-name">
              <Input
                id="atlas-name"
                placeholder="repo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Branch (optional)" htmlFor="atlas-branch">
              <Input
                id="atlas-branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </Field>
          </div>
          {create.isError && (
            <p className="flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--accent-negative-fg)]">
              <AlertCircle className="size-[var(--space-4)]" />
              {(create.error as Error)?.message ?? 'Could not add source'}
            </p>
          )}
          <div className="flex items-center gap-[var(--space-2)]">
            <Button type="submit" size="sm" disabled={create.isPending || !location.trim()}>
              {create.isPending ? 'Adding…' : 'Add source'}
            </Button>
            {showCancel && (
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function SourceCard({
  source,
  spaceId,
  canManage,
  selected,
  onSelect,
}: {
  source: AtlasSource
  spaceId: number
  canManage: boolean
  selected: boolean
  onSelect: () => void
}) {
  const startRun = useStartAtlasRun(spaceId)
  const del = useDeleteAtlasSource(spaceId)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full rounded-[var(--radius-md)] border p-[var(--space-3)] text-left transition-colors',
        selected
          ? 'border-[var(--accent)] bg-[var(--surface-2)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <GitBranch className="size-[var(--space-4)] shrink-0 text-[var(--text-muted)]" />
        <span className="truncate text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
          {source.name || repoLabel(source.location)}
        </span>
      </div>
      <div className="mt-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)]">
        <StatusBadge tone={statusTone(source.last_run_status)} dot={source.last_run_status === 'running'}>
          {source.last_run_status ?? 'never run'}
        </StatusBadge>
        {source.last_must_rate != null && (
          <span className="text-[length:var(--text-xs)] font-[family-name:var(--font-mono)] text-[var(--text-muted)]">
            {Math.round(source.last_must_rate * 100)}% must-cover
          </span>
        )}
      </div>
      {canManage && (
        <div
          className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)]"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            disabled={startRun.isPending || source.last_run_status === 'running'}
            onClick={() => startRun.mutate(source.id)}
          >
            <Play className="size-[var(--space-3)]" /> Run
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Delete source"
            onClick={() => {
              if (confirm('Remove this source? Generated pages are kept.')) del.mutate(source.id)
            }}
          >
            <Trash2 className="size-[var(--space-4)] text-[var(--text-muted)]" />
          </Button>
        </div>
      )}
    </button>
  )
}

function SourceDetail({
  source,
  spaceId,
}: {
  source: AtlasSource
  canManage: boolean
  spaceId: number
}) {
  // The latest run drives the live panel; re-keyed when the source changes.
  return (
    <RunPanel
      key={source.id}
      runId={source.last_run_id ?? null}
      sourceLocation={source.location}
      spaceId={spaceId}
    />
  )
}

function RunPanel({
  runId,
  sourceLocation,
}: {
  runId: number | null
  sourceLocation: string
  spaceId: number
}) {
  const runQ = useAtlasRun(runId)
  const run = runQ.data?.run
  const { events, streaming } = useAtlasRunStream(runId, {
    onEnd: () => void runQ.refetch(),
  })
  const last = events[events.length - 1]
  const stage = last?.stage ?? run?.stage

  if (runId == null) {
    return (
      <EmptyState
        icon={Play}
        title="No runs yet"
        description={`Run generation to produce coverage-audited docs from ${repoLabel(sourceLocation)}.`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-[var(--space-3)]">
            <CardTitle>Run #{runId}</CardTitle>
            <div className="flex items-center gap-[var(--space-2)]">
              {stage && (
                <span className="text-[length:var(--text-xs)] font-[family-name:var(--font-mono)] text-[var(--text-muted)]">
                  {stage}
                </span>
              )}
              <StatusBadge tone={statusTone(run?.status)} dot={run?.status === 'running' || streaming}>
                {run?.status ?? (streaming ? 'running' : 'pending')}
              </StatusBadge>
            </div>
          </div>
        </CardHeader>
        <CardBody className="flex flex-col gap-[var(--space-3)]">
          {streaming && last && last.total > 0 && (
            <Progress value={last.cur} max={last.total} tone="neutral" />
          )}
          <RunLog events={events} />
          {run?.err && (
            <p className="flex items-start gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--accent-negative-fg)]">
              <AlertCircle className="mt-[2px] size-[var(--space-4)] shrink-0" />
              {run.err}
            </p>
          )}
        </CardBody>
      </Card>

      {run?.coverage && <CoveragePanel run={run} />}
    </div>
  )
}

function RunLog({ events }: { events: { stage: string; msg: string; level: string }[] }) {
  if (events.length === 0) {
    return (
      <p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Waiting for progress…</p>
    )
  }
  const tail = events.slice(-200)
  return (
    <div className="max-h-[18rem] overflow-auto rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)]">
      <ul className="flex flex-col gap-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] leading-[var(--leading-tight)]">
        {tail.map((e, i) => (
          <li
            key={i}
            className={
              e.level === 'error'
                ? 'text-[var(--accent-negative-fg)]'
                : e.level === 'warn'
                  ? 'text-[var(--accent-warning-fg)]'
                  : 'text-[var(--text-muted)]'
            }
          >
            <span className="text-[var(--text-primary)]">{e.stage}</span> {e.msg}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CoveragePanel({ run }: { run: AtlasRun }) {
  const cov = run.coverage!
  const stats = run.stats
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-[var(--space-4)]">
        <div className="flex flex-wrap items-center gap-[var(--space-6)]">
          <CoverageGauge value={mustCoverRate(cov)} caption="must-cover" />
          <CoverageGauge value={coverageRate(cov)} caption="surface" />
          <dl className="grid grid-cols-2 gap-x-[var(--space-5)] gap-y-[var(--space-1)] text-[length:var(--text-sm)]">
            <Stat label="Surface" value={`${cov.covered}/${cov.total}`} />
            <Stat label="Must-cover" value={`${cov.must_covered}/${cov.must_total}`} />
            <Stat
              label="Citations"
              value={`${cov.citations}${cov.bad_citations ? ` (${cov.bad_citations} bad)` : ''}`}
            />
            <Stat label="Diagrams" value={String(cov.mermaid)} />
            {stats && <Stat label="Pages" value={String(stats.pages)} />}
            {stats && <Stat label="Files" value={String(stats.files)} />}
          </dl>
        </div>

        {cov.gaps.length > 0 && (
          <details className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--space-3)]">
            <summary className="cursor-pointer text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
              Undocumented surface ({cov.gaps.length})
            </summary>
            <ul className="mt-[var(--space-2)] flex flex-col gap-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--text-muted)]">
              {cov.gaps.slice(0, 100).map((g, i) => (
                <li key={i}>
                  <span className="text-[var(--accent-warning-fg)]">{g.kind}</span> {g.name}
                  {g.file ? ` — ${g.file}:${g.line}` : ''}
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
    <>
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right font-[family-name:var(--font-mono)] text-[var(--text-primary)]">
        {value}
      </dd>
    </>
  )
}
