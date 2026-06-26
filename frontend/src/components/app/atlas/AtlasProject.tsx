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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import {
  type AtlasCadence,
  type AtlasProject as AtlasProjectT,
  type AtlasRunSummary,
  type AtlasSource,
  mustCoverRate,
  useAtlasProject,
  useDeleteProject,
  useDeleteSource,
  usePatchProject,
  useStartProjectRun,
  useStartSourceRun,
  useSyncSource,
} from '../../../lib/queries/atlas'
import { useSpaces } from '../../../lib/queries/spaces'
import { usePages } from '../../../lib/queries/pages'
import { fmtRelative, fmtUntil, runLabel, runTone } from './atlas-lib'
import { Field } from './NewProjectDialog'
import { AddSourceDialog } from './AddSourceDialog'

export function AtlasProject() {
  const { projectId } = useParams({ from: '/_app/atlas/projects/$projectId' })
  const q = useAtlasProject(projectId)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
            <Button variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Project settings"><Settings2 className="size-[var(--space-4)]" /></Button>
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
      {canManage && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} project={project} />}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[68rem] px-[var(--space-5)] py-[var(--space-5)]">{children}</div>
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-[var(--radius-sm)] border px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-xs)] font-medium transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--sidebar-item-active)] text-[var(--accent)]'
          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
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

const CADENCES: { value: AtlasCadence; label: string }[] = [
  { value: '', label: 'Manual — I run it' },
  { value: 'hourly', label: 'Automatic · hourly' },
  { value: 'daily', label: 'Automatic · daily' },
  { value: 'weekly', label: 'Automatic · weekly' },
  { value: 'monthly', label: 'Automatic · monthly' },
]

function SettingsDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (v: boolean) => void; project: AtlasProjectT }) {
  const navigate = useNavigate()
  const patch = usePatchProject()
  const del = useDeleteProject()
  const [name, setName] = useState(project.name)
  const [cadence, setCadence] = useState<AtlasCadence>(project.cadence)
  const [confirmDel, setConfirmDel] = useState(false)

  // Output destination: an existing space (optionally under a top-dir page) or a
  // new space materialized on the next run. Only sent on save if actually edited,
  // so opening settings + saving never silently re-points or clears the top-dir.
  const spacesQ = useSpaces()
  const [outMode, setOutMode] = useState<'existing' | 'new'>(project.output_space ? 'existing' : 'new')
  const [outSpaceId, setOutSpaceId] = useState<number | undefined>(project.output_space?.id)
  const [outNewName, setOutNewName] = useState(project.name)
  const [outParent, setOutParent] = useState<number | undefined>(project.output_parent_page_id)
  const [outDirty, setOutDirty] = useState(false)
  const dirPagesQ = usePages({ spaceId: outMode === 'existing' ? outSpaceId : undefined, parentId: null })
  const dirPages = (dirPagesQ.data ?? []) as { id: number; title: string }[]

  async function save() {
    const output = !outDirty
      ? undefined
      : outMode === 'new'
        ? { new_space_name: outNewName.trim() }
        : { space_id: outSpaceId, parent_page_id: outParent }
    await patch.mutateAsync({
      id: project.id,
      patch: { name: name.trim() || project.name, cadence, auto_update: cadence !== '', ...(output ? { output } : {}) },
    })
    onOpenChange(false)
  }
  async function remove() {
    await del.mutateAsync(project.id)
    navigate({ to: '/atlas' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Name, schedule, and where the generated docs land.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Refresh">
            <Select value={cadence} onChange={(e) => setCadence(e.target.value as AtlasCadence)}>
              {CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Output" hint="Where docs land — each source publishes under its own folder beneath this.">
            <div className="flex flex-col gap-[var(--space-2)]">
              <div className="flex gap-[var(--space-1)]">
                <ModeBtn active={outMode === 'existing'} onClick={() => { setOutMode('existing'); setOutDirty(true) }}>Existing space</ModeBtn>
                <ModeBtn active={outMode === 'new'} onClick={() => { setOutMode('new'); setOutDirty(true) }}>New space</ModeBtn>
              </div>
              {outMode === 'existing' ? (
                <>
                  <Select
                    value={outSpaceId != null ? String(outSpaceId) : ''}
                    onChange={(e) => { setOutSpaceId(e.target.value ? Number(e.target.value) : undefined); setOutParent(undefined); setOutDirty(true) }}
                  >
                    <option value="">Select a space…</option>
                    {(spacesQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  <Select
                    value={outParent != null ? String(outParent) : ''}
                    onChange={(e) => { setOutParent(e.target.value ? Number(e.target.value) : undefined); setOutDirty(true) }}
                    disabled={outSpaceId == null}
                  >
                    <option value="">Top-dir: space root</option>
                    {dirPages.map((p) => <option key={p.id} value={p.id}>Under “{p.title}”</option>)}
                  </Select>
                </>
              ) : (
                <Input value={outNewName} onChange={(e) => { setOutNewName(e.target.value); setOutDirty(true) }} placeholder="New space name" />
              )}
            </div>
          </Field>
          <div className="mt-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-[var(--space-3)]">
            {confirmDel ? (
              <div className="flex items-center justify-between gap-[var(--space-3)]">
                <span className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Delete this project? The output space is kept.</span>
                <div className="flex gap-[var(--space-2)]">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancel</Button>
                  <Button variant="danger" size="sm" disabled={del.isPending} onClick={remove}>Delete</Button>
                </div>
              </div>
            ) : (
              <button type="button" className="text-[length:var(--text-sm)] text-[var(--accent-negative-fg)] hover:underline" onClick={() => setConfirmDel(true)}>Delete project…</button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={patch.isPending} onClick={save}>
            {patch.isPending && <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
