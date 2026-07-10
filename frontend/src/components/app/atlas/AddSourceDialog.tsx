import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import {
  type AtlasOwner,
  type AtlasSourceType,
  useAtlasCredentials,
  useCreateSource,
} from '../../../lib/queries/atlas'
import { useMe } from '../../../lib/queries/auth'
import { Field } from './NewProjectDialog'

// Derive a default source name from a git URL / jira key (last path segment).
function deriveName(loc: string): string {
  const cleaned = loc.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  const seg = cleaned.split(/[/:]/).filter(Boolean).pop() ?? ''
  return seg
}

export function AddSourceDialog({
  open,
  onOpenChange,
  projectId,
  owner,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: number
  owner: AtlasOwner
}) {
  const create = useCreateSource(projectId)
  const credsQ = useAtlasCredentials()
  const meQ = useMe()
  const [type, setType] = useState<AtlasSourceType>('git')
  const [location, setLocation] = useState('')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [branch, setBranch] = useState('')
  const [subpath, setSubpath] = useState('')
  const [credId, setCredId] = useState<string>('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setType('git'); setLocation(''); setName(''); setNameTouched(false)
      setBranch(''); setSubpath(''); setCredId(''); setErr(null)
    }
  }, [open])

  // Bindable credentials of the source's kind: the project owner's reusable creds
  // PLUS the current user's own personal creds (lent to this source without
  // entering the org pool — others can run but not see/reuse them). A personal
  // cred on an org project is flagged so the choice is explicit.
  const meId = meQ.data?.id
  const creds = useMemo(() => {
    return (credsQ.data?.credentials ?? [])
      .filter((c) => c.kind === type)
      .filter((c) => (c.owner_kind === owner.kind && c.owner_id === owner.id) || (c.owner_kind === 'user' && c.owner_id === meId))
      .map((c) => {
        const personal = c.owner_kind === 'user' && c.owner_id === meId
        const ownedByProject = c.owner_kind === owner.kind && c.owner_id === owner.id
        return { ...c, label: personal && !ownedByProject ? `${c.name} (личное — доступно только вам)` : c.name }
      })
  }, [credsQ.data, owner, type, meId])
  const effectiveName = nameTouched ? name : deriveName(location)

  async function submit() {
    if (!location.trim()) return
    setErr(null)
    try {
      await create.mutateAsync({
        type,
        location: location.trim(),
        name: effectiveName.trim() || undefined,
        branch: branch.trim() || undefined,
        subpath: subpath.trim() || undefined,
        cred_id: credId ? Number(credId) : undefined,
      })
      onOpenChange(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось добавить источник.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить источник</DialogTitle>
          <DialogDescription>
            Документы попадают в папку, названную по источнику, внутри пространства вывода проекта.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]">
          <div className="grid grid-cols-[8rem_1fr] gap-[var(--space-3)]">
            <Field label="Тип">
              <Select value={type} onChange={(e) => setType(e.target.value as AtlasSourceType)}>
                <option value="git">Git-репозиторий</option>
                <option value="jira">Jira-проект</option>
              </Select>
            </Field>
            <Field label={type === 'git' ? 'URL репозитория' : 'Jira base · ключ проекта'}>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={type === 'git' ? 'https://github.com/org/repo' : 'https://org.atlassian.net · ПРОЕКТ'} autoFocus />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <Field label="Название" hint="Folder name in the space.">
              <Input value={effectiveName} onChange={(e) => { setNameTouched(true); setName(e.target.value) }} placeholder="репозиторий" />
            </Field>
            {type === 'git' && (
              <Field label="Ветка" hint="Ветка по умолчанию, если не указана.">
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
              </Field>
            )}
          </div>

          {type === 'git' && (
            <Field label="Подпуть" hint="Ограничить директорией (необязательно).">
              <Input value={subpath} onChange={(e) => setSubpath(e.target.value)} placeholder="packages/core" />
            </Field>
          )}

          <Field label="Учётные данные" hint={creds.length === 0 ? 'Не нужны для публичных репозиториев. Добавьте в Учётных данных для приватных источников.' : 'Переиспользуются для источников с тем же владельцем.'}>
            <Select value={credId} onChange={(e) => setCredId(e.target.value)} disabled={creds.length === 0}>
              <option value="">{type === 'git' ? 'Публичный — без учётных данных' : 'Нет'}</option>
              {creds.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>

          {err && <p className="text-[length:var(--text-sm)] text-[var(--accent-negative-fg)]">{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" disabled={!location.trim() || create.isPending} onClick={submit}>
            {create.isPending && <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" />}Добавить источник
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
