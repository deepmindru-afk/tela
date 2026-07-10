import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, FolderGit2, Loader2 } from 'lucide-react'
import { Button } from '../../ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '../../ui/card'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import { EmptyState } from '../../ui/empty-state'
import { useSpaces } from '../../../lib/queries/spaces'
import { usePages } from '../../../lib/queries/pages'
import {
  type AtlasCadence,
  useAtlasProject,
  useDeleteProject,
  usePatchProject,
} from '../../../lib/queries/atlas'
import { Field, FieldBlock } from './NewProjectDialog'
import { SpacePicker, type SpaceChoice } from './SpacePicker'

const CADENCES: { value: AtlasCadence; label: string }[] = [
  { value: '', label: 'Вручную — запускаю сам' },
  { value: 'hourly', label: 'Автоматически · ежечасно' },
  { value: 'daily', label: 'Автоматически · ежедневно' },
  { value: 'weekly', label: 'Автоматически · еженедельно' },
  { value: 'monthly', label: 'Автоматически · ежемесячно' },
]

export function AtlasProjectSettings() {
  const { projectId } = useParams({ from: '/_app/atlas/projects/$projectId/settings' })
  const navigate = useNavigate()
  const q = useAtlasProject(projectId)
  const project = q.data?.project

  const spacesQ = useSpaces()
  const patch = usePatchProject()
  const del = useDeleteProject()

  const [name, setName] = useState('')
  const [cadence, setCadence] = useState<AtlasCadence>('daily')
  const [output, setOutput] = useState<SpaceChoice>({})
  const [parentId, setParentId] = useState<number | undefined>(undefined)
  const [outDirty, setOutDirty] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [seeded, setSeeded] = useState(false)

  // Seed the form once the project loads.
  if (project && !seeded) {
    setName(project.name)
    setCadence(project.cadence)
    setOutput(project.output_space ? { space_id: project.output_space.id } : {})
    setParentId(project.output_parent_page_id)
    setSeeded(true)
  }

  const dirPagesQ = usePages({ spaceId: output.space_id, parentId: null })
  const dirPages = (dirPagesQ.data ?? []) as { id: number; title: string }[]

  if (q.isLoading) {
    return <Shell><p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Загрузка…</p></Shell>
  }
  if (!project) {
    return <Shell><EmptyState icon={FolderGit2} title="Проект не найден" description="Он не существует или у вас нет доступа." /></Shell>
  }

  const backToProject = () => navigate({ to: '/atlas/projects/$projectId', params: { projectId: project.id } })

  async function save() {
    if (!project) return
    const out = !outDirty
      ? undefined
      : output.space_id != null
        ? { space_id: output.space_id, parent_page_id: parentId }
        : output.new_space_name
          ? { new_space_name: output.new_space_name }
          : undefined
    // Scheduled refresh is a paid capability; if the owner's plan lacks it, force
    // manual so we never persist an auto cadence the server will silently skip.
    const effCadence = project.scheduled_allowed ? cadence : ''
    await patch.mutateAsync({
      id: project.id,
      patch: { name: name.trim() || project.name, cadence: effCadence, auto_update: effCadence !== '', ...(out ? { output: out } : {}) },
    })
    backToProject()
  }

  async function remove() {
    if (!project) return
    await del.mutateAsync(project.id)
    navigate({ to: '/atlas' })
  }

  return (
    <Shell>
      <Link to="/atlas/projects/$projectId" params={{ projectId: project.id }} className="mb-[var(--space-2)] inline-flex items-center gap-[var(--space-1)] text-[length:var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft className="size-[var(--space-3)]" /> {project.name}
      </Link>
      <h1 className="text-[length:var(--text-2xl)] font-semibold text-[var(--text-primary)]">Настройки проекта</h1>
      <p className="mt-[var(--space-1)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
        {project.owner.kind === 'org' ? `${project.owner.name} · орг` : 'Личное'}
      </p>

      <div className="mt-[var(--space-5)] flex flex-col gap-[var(--space-4)]">
        <Card>
          <CardHeader><CardTitle>Основное</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-[var(--space-4)]">
            <Field label="Название"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            {project.scheduled_allowed ? (
              <Field label="Обновление" hint="Как часто Атлас перезапускает проект для актуализации документации.">
                <Select value={cadence} onChange={(e) => setCadence(e.target.value as AtlasCadence)}>
                  {CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Обновление" hint="Запускайте проект вручную в любое время со страницы проекта. Автоматическое обновление доступно на платных тарифах.">
                <Select value="" disabled>
                  <option value="">Вручную — запускаю сам</option>
                </Select>
                <a href="/settings?tab=billing" className="mt-[var(--space-1)] inline-block text-[length:var(--text-xs)] font-medium text-[var(--accent)] hover:underline">
                  Обновить тариф для автозапуска →
                </a>
              </Field>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Вывод</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-[var(--space-4)]">
            <FieldBlock label="Пространство" hint="Куда попадают документы. Выберите существующее пространство или введите название для создания при следующем запуске.">
              <SpacePicker
                spaces={(spacesQ.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
                value={output}
                onChange={(v) => { setOutput(v); setParentId(undefined); setOutDirty(true) }}
              />
            </FieldBlock>
            {output.space_id != null && (
              <Field label="Корневая папка" hint="Необязательная папка внутри пространства; каждый источник публикуется в своей подпапке.">
                <Select value={parentId != null ? String(parentId) : ''} onChange={(e) => { setParentId(e.target.value ? Number(e.target.value) : undefined); setOutDirty(true) }}>
                  <option value="">Корень пространства</option>
                  {dirPages.map((p) => <option key={p.id} value={p.id}>Внутри "{p.title}"</option>)}
                </Select>
              </Field>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Опасная зона</CardTitle></CardHeader>
          <CardBody>
            {confirmDel ? (
              <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
                <span className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Удалить проект? Пространство вывода и сгенерированные документы останутся.</span>
                <div className="flex gap-[var(--space-2)]">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Отмена</Button>
                  <Button variant="danger" size="sm" disabled={del.isPending} onClick={remove}>
                    {del.isPending && <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" />}Удалить проект
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" className="text-[length:var(--text-sm)] font-medium text-[var(--accent-negative-fg)] hover:underline" onClick={() => setConfirmDel(true)}>
                Удалить проект…
              </button>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-[var(--space-5)] flex justify-end gap-[var(--space-2)]">
        <Button variant="ghost" onClick={backToProject}>Отмена</Button>
        <Button variant="primary" disabled={patch.isPending} onClick={save}>
          {patch.isPending && <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" />}Сохранить изменения
        </Button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[48rem] px-[var(--space-5)] py-[var(--space-5)]">{children}</div>
}
