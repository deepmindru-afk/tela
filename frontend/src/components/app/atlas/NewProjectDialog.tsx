import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import { useSpaces } from '../../../lib/queries/spaces'
import { usePages } from '../../../lib/queries/pages'
import { type AtlasOwner, useCreateProject } from '../../../lib/queries/atlas'
import { SpacePicker, type SpaceChoice } from './SpacePicker'

export function NewProjectDialog({
  open,
  onOpenChange,
  owners,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  owners: AtlasOwner[]
}) {
  const navigate = useNavigate()
  const create = useCreateProject()
  const spacesQ = useSpaces()
  const [name, setName] = useState('')
  const [ownerIdx, setOwnerIdx] = useState(0)
  const [output, setOutput] = useState<SpaceChoice>({})
  const [parentId, setParentId] = useState<number | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setOwnerIdx(0)
      setOutput({})
      setParentId(undefined)
      setErr(null)
    }
  }, [open])

  // Top-level pages of the chosen existing space, for the optional top-dir.
  const dirPagesQ = usePages({ spaceId: output.space_id, parentId: null })
  const dirPages = (dirPagesQ.data ?? []) as { id: number; title: string }[]

  const owner = owners[ownerIdx]
  const canSubmit = useMemo(
    () => name.trim().length > 0 && owner != null && !create.isPending,
    [name, owner, create.isPending],
  )

  async function submit() {
    if (!owner) return
    setErr(null)
    // Output defaults to a new space named after the project when left untouched.
    const out =
      output.space_id != null
        ? { space_id: output.space_id, parent_page_id: parentId }
        : { new_space_name: (output.new_space_name || name).trim() }
    try {
      const { project } = await create.mutateAsync({
        name: name.trim(),
        owner_kind: owner.kind,
        owner_id: owner.id,
        output: out,
        // Default to automatic WEEKLY refresh. The scheduler regenerates only
        // sources that actually moved; on Free it's a no-op the server skips
        // (drift is still detected, so the stale badge prompts a manual run) and
        // it activates automatically on upgrade. Editable in settings.
        //
        // This was 'hourly' until 2026-08-10, which re-indexed the whole repo
        // every hour for anyone who never opened settings — and since the plan
        // meters GPU minutes, hourly spent a month's budget in about a day and
        // then paused updates until the 1st. Weekly costs a fraction of that and
        // keeps refreshing all month, so it is the better default in the user's
        // interest as well as the box's. Keep it in step with the DB default
        // (migration 0074) if either changes.
        cadence: 'weekly',
        auto_update: true,
      })
      onOpenChange(false)
      navigate({ to: '/atlas/projects/$projectId', params: { projectId: project.id } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось создать проект.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый проект Атласа</DialogTitle>
          <DialogDescription>
            Проект объединяет источники в одном выходном пространстве. Добавьте репозитории или проекты Jira и запустите его. На платных тарифах проект автоматически обновляется по расписанию; в любой момент его можно запустить вручную. Настройки доступны в настройках проекта.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]">
          <Field label="Название проекта">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="например, Payments API" autoFocus />
          </Field>

          {owners.length > 1 && (
            <Field label="Владелец" hint="Кто управляет проектом — вы или администраторы организации.">
              <Select value={String(ownerIdx)} onChange={(e) => setOwnerIdx(Number(e.target.value))}>
                {owners.map((o, i) => (
                  <option key={`${o.kind}:${o.id}`} value={i}>
                    {o.kind === 'user' ? `${o.name} (личный)` : `${o.name} (организация)`}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <FieldBlock label="Пространство вывода" hint={`Выберите существующее пространство или назовите новое. Новое пространство будет создано ${owner?.kind === 'org' ? `в организации ${owner.name}` : 'как личное'} (владелец проекта); по умолчанию берётся название проекта.`}>
            <SpacePicker
              spaces={(spacesQ.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
              value={output}
              onChange={(v) => { setOutput(v); setParentId(undefined) }}
              placeholder={name.trim() ? `По умолчанию: «${name.trim()}» (новое пространство)` : 'Найдите пространство или введите название нового…'}
            />
          </FieldBlock>

          {output.space_id != null && (
            <Field label="Верхняя папка" hint="Необязательная папка внутри пространства; каждый источник публикуется в собственной папке внутри неё.">
              <Select value={parentId != null ? String(parentId) : ''} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Корень пространства</option>
                {dirPages.map((p) => <option key={p.id} value={p.id}>Внутри «{p.title}»</option>)}
              </Select>
            </Field>
          )}

          {err && <p className="text-[length:var(--text-sm)] text-[var(--accent-negative-fg)]">{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            {create.isPending && <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" />}
            Создать проект
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// A labelled field whose control is a real form element — uses <label> so the
// caption focuses it.
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[var(--space-1)]">
      <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">{label}</span>
      {children}
      {hint && <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{hint}</span>}
    </label>
  )
}

// Like Field but a plain <div> — for composite controls (e.g. the SpacePicker
// combobox) where a wrapping <label> would hijack clicks on the dropdown.
export function FieldBlock({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">{label}</span>
      {children}
      {hint && <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{hint}</span>}
    </div>
  )
}
