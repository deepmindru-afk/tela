import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  ExternalLink,
  FolderGit2,
  GitBranch,
  KeyRound,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react'
import { Button } from '../../ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '../../ui/card'
import { StatusBadge } from '../../ui/status-badge'
import { EmptyState } from '../../ui/empty-state'
import {
  type AtlasRunSummary,
  type AtlasSource,
  mustCoverRate,
  useAtlasProject,
  useDeleteSource,
  useStartProjectRun,
  useStartSourceRun,
  useSyncSource,
} from '../../../lib/queries/atlas'
import { fmtRelative, fmtUntil, runLabel, runTone } from './atlas-lib'
import { AddSourceDialog } from './AddSourceDialog'

export function AtlasProject() {
  const { projectId } = useParams({ from: '/_app/atlas/projects/$projectId' })
  const q = useAtlasProject(projectId)
  const [addOpen, setAddOpen] = useState(false)
  const runAll = useStartProjectRun()

  if (q.isLoading) {
    return <Shell><p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Loading project…</p></Shell>
  }
  if (!q.data) {
    return <Shell><EmptyState icon={FolderGit2} title="Project not found" description="It doesn't exist or you can't access it." /></Shell>
  }

  const { project, sources, runs } = q.data
  const canManage = project.can_manage
  const schedule = project.cadence && project.auto_update
    ? `auto · ${project.cadence}${project.next_due ? ` · next ${fmtUntil(project.next_due)}` : ''}`
    : 'manual refresh'

  return (
    <Shell>
      <Link to="/atlas" className="mb-[var(--space-2)] inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft className="size-[var(--space-3)]" /> Atlas
      </Link>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div className="min-w-0">
          <h1 className="text-[length:var(--text-2xl)] font-semibold text-[var(--text-primary)]">{project.name}</h1>
          <div className="mt-[var(--space-2)] flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
            <span>{project.owner.kind === 'org' ? `${project.owner.name} · org` : 'Personal'}</span>
            <span className="opacity-60">·</span>
            <span>{schedule}</span>
            {project.last_refresh_at && (
              <>
                <span className="opacity-60">·</span>
                <span>updated {fmtRelative(project.last_refresh_at)}</span>
              </>
            )}
            {project.output_space && (
              <>
                <span className="opacity-60">·</span>
                <a href={`/spaces/${project.output_space.id}`} className="inline-flex items-center gap-[2px] text-[var(--accent)] hover:underline">
                  {project.output_space.name} <ExternalLink className="size-[var(--space-3)]" />
                </a>
              </>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-[var(--space-2)]">
            <Button asChild variant="ghost" aria-label="Project settings">
              <Link to="/atlas/projects/$projectId/settings" params={{ projectId: project.id }}><Settings2 className="size-[var(--space-4)]" /></Link>
            </Button>
            <Button variant="secondary" onClick={() => setAddOpen(true)}><Plus className="size-[var(--space-4)]" /> Add source</Button>
            <Button variant="primary" disabled={sources.length === 0 || runAll.isPending} onClick={() => runAll.mutate(project.id)}>
              {runAll.isPending ? <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" /> : <Play className="size-[var(--space-4)]" />} Run all
            </Button>
          </div>
        )}
      </div>

      {/* sources */}
      <Card className="mt-[var(--space-5)]">
        <CardHeader><CardTitle>Sources · {sources.length}</CardTitle></CardHeader>
        <CardBody>
          {sources.length === 0 ? (
            <div className="flex flex-col items-center gap-[var(--space-3)] py-[var(--space-4)] text-center">
              <p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">No sources yet. Add a git repo or Jira project to generate docs from.</p>
              {canManage && <Button variant="secondary" onClick={() => setAddOpen(true)}><Plus className="size-[var(--space-4)]" /> Add source</Button>}
            </div>
          ) : (
            <ul className="flex flex-col">
              {sources.map((s, i) => (
                <SourceRow key={s.id} s={s} first={i === 0} projectId={project.id} canManage={canManage} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* runs */}
      <Card className="mt-[var(--space-4)]">
        <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
        <CardBody>
          {runs.length === 0 ? (
            <p className="py-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-muted)]">No runs yet.</p>
          ) : (
            <ul className="flex flex-col">
              {runs.map((r, i) => <RunRow key={r.id} r={r} first={i === 0} />)}
            </ul>
          )}
        </CardBody>
      </Card>

      {canManage && <AddSourceDialog open={addOpen} onOpenChange={setAddOpen} projectId={project.id} owner={project.owner} />}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[68rem] px-[var(--space-5)] py-[var(--space-5)]">{children}</div>
}

function SourceRow({ s, first, projectId, canManage }: { s: AtlasSource; first: boolean; projectId: number; canManage: boolean }) {
  const navigate = useNavigate()
  const run = useStartSourceRun(projectId)
  const sync = useSyncSource(projectId)
  const del = useDeleteSource(projectId)
  const busy = run.isPending || sync.isPending

  async function doRun() {
    const { run_id } = await run.mutateAsync(s.id)
    navigate({ to: '/atlas/runs/$runId', params: { runId: run_id } })
  }
  async function doSync() {
    const res = await sync.mutateAsync(s.id)
    if (res.run_id) navigate({ to: '/atlas/runs/$runId', params: { runId: res.run_id } })
  }

  return (
    <li className={['flex items-center gap-[var(--space-3)] py-[var(--space-3)]', first ? '' : 'border-t border-[var(--border-subtle)]'].join(' ')}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="truncate text-[length:var(--text-sm)] font-semibold text-[var(--text-primary)]">{s.name}</span>
          {s.last_run_status && (
            <StatusBadge tone={runTone(s.last_run_status)} dot={s.last_run_status === 'running'}>{runLabel(s.last_run_status)}</StatusBadge>
          )}
        </div>
        <div className="mt-[2px] flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[2px] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--text-muted)]">
          <span className="truncate">{s.location}</span>
          {s.branch && <span className="inline-flex items-center gap-[2px]"><GitBranch className="size-[var(--space-3)]" />{s.branch}</span>}
          {s.subpath && <span>/{s.subpath}</span>}
          {s.cred_id != null && <KeyRound className="size-[var(--space-3)]" aria-label="uses a credential" />}
        </div>
      </div>
      {s.last_must_rate != null && (
        <button
          type="button"
          onClick={() => s.last_run_id && navigate({ to: '/atlas/runs/$runId', params: { runId: s.last_run_id } })}
          className="hidden whitespace-nowrap font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)] sm:inline"
        >
          must-cover {Math.round(s.last_must_rate * 100)}%
        </button>
      )}
      {canManage && (
        <div className="flex items-center gap-[var(--space-1)]">
          <Button variant="ghost" size="sm" disabled={busy} onClick={doRun} aria-label="Run now">
            {run.isPending ? <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" /> : <Play className="size-[var(--space-4)]" />}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={doSync} aria-label="Sync changes">
            {sync.isPending ? <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" /> : <RefreshCw className="size-[var(--space-4)]" />}
          </Button>
          <Button variant="ghost" size="sm" disabled={del.isPending} onClick={() => del.mutate(s.id)} aria-label="Delete source">
            <Trash2 className="size-[var(--space-4)]" />
          </Button>
        </div>
      )}
    </li>
  )
}

function RunRow({ r, first }: { r: AtlasRunSummary; first: boolean }) {
  const navigate = useNavigate()
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate({ to: '/atlas/runs/$runId', params: { runId: r.id } })}
        className={['group flex w-full items-center gap-[var(--space-3)] py-[var(--space-3)] text-left', first ? '' : 'border-t border-[var(--border-subtle)]'].join(' ')}
      >
        <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--text-muted)]">#{r.id}</span>
        <StatusBadge tone={runTone(r.status)} dot={r.status === 'running'}>{runLabel(r.status)}</StatusBadge>
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{r.kind}</span>
        <span className="flex-1" />
        {r.coverage && (
          <span className="hidden font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--text-muted)] sm:inline">
            must-cover {Math.round(mustCoverRate(r.coverage) * 100)}%
          </span>
        )}
        <span className="whitespace-nowrap text-[length:var(--text-xs)] text-[var(--text-muted)]">{fmtRelative(r.started_at)}</span>
      </button>
    </li>
  )
}

