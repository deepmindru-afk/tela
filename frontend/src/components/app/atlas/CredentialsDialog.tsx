import { useState } from 'react'
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import {
  type AtlasOwner,
  type AtlasSourceType,
  useAtlasCredentials,
  useCreateCredential,
  useDeleteCredential,
} from '../../../lib/queries/atlas'
import { Field } from './NewProjectDialog'

export function CredentialsDialog({
  open,
  onOpenChange,
  owners,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  owners: AtlasOwner[]
}) {
  const credsQ = useAtlasCredentials()
  const creds = credsQ.data?.credentials ?? []
  const create = useCreateCredential()
  const del = useDeleteCredential()

  const [adding, setAdding] = useState(false)
  const [ownerIdx, setOwnerIdx] = useState(0)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AtlasSourceType>('git')
  const [value, setValue] = useState('')
  const [user, setUser] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const owner = owners[ownerIdx]
  async function add() {
    if (!owner || !name.trim() || !value.trim()) return
    setErr(null)
    try {
      await create.mutateAsync({
        owner_kind: owner.kind,
        owner_id: owner.id,
        name: name.trim(),
        kind,
        value: value.trim(),
        meta: kind === 'jira' && user.trim() ? { username: user.trim() } : undefined,
      })
      setAdding(false)
      setName('')
      setValue('')
      setUser('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить учётные данные.')
    }
  }

  const ownerName = (c: { owner_kind: string; owner_id: number }) =>
    owners.find((o) => o.kind === c.owner_kind && o.id === c.owner_id)?.name ?? (c.owner_kind === 'user' ? 'Личное' : `орг ${c.owner_id}`)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Учётные данные</DialogTitle>
          <DialogDescription>
            Многоразовые токены для приватных источников — ваши или организации, привязываются к источнику при добавлении. Токены доступны только для записи; они больше никогда не отображаются.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-2)] py-[var(--space-2)]">
          {credsQ.isLoading ? (
            <p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Загрузка…</p>
          ) : creds.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] p-[var(--space-4)] text-center text-[length:var(--text-sm)] text-[var(--text-muted)]">
              Учётных данных пока нет. Публичным репозиториям они не нужны.
            </p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-1)]">
              {creds.map((c) => (
                <li key={c.id} className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-[var(--space-3)] py-[var(--space-2)]">
                  <KeyRound className="size-[var(--space-4)] text-[var(--text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">{c.name}</div>
                    <div className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{c.kind} · {ownerName(c)}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => del.mutate(c.id)} aria-label={`Удалить ${c.name}`}>
                    <Trash2 className="size-[var(--space-4)]" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <div className="mt-[var(--space-2)] flex flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-[var(--space-3)]">
              {owners.length > 1 && (
                <Field label="Владелец">
                  <Select value={String(ownerIdx)} onChange={(e) => setOwnerIdx(Number(e.target.value))}>
                    {owners.map((o, i) => (
                      <option key={`${o.kind}:${o.id}`} value={i}>{o.kind === 'user' ? `${o.name} (личное)` : `${o.name} (org)`}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-[var(--space-3)]">
                <Field label="Название"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="github-readonly" /></Field>
                <Field label="Тип">
                  <Select value={kind} onChange={(e) => setKind(e.target.value as AtlasSourceType)}>
                    <option value="git">Git-токен</option>
                    <option value="jira">Jira-токен</option>
                  </Select>
                </Field>
              </div>
              {kind === 'jira' && <Field label="Jira имя пользователя / email"><Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="you@org.com" /></Field>}
              <Field label="Токен" hint="Хранится зашифрованным; больше никогда не отображается."><Input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ghp_…" /></Field>
              {err && <p className="text-[length:var(--text-sm)] text-[var(--accent-negative-fg)]">{err}</p>}
              <div className="flex justify-end gap-[var(--space-2)]">
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Отмена</Button>
                <Button variant="primary" size="sm" disabled={!name.trim() || !value.trim() || create.isPending} onClick={add}>
                  {create.isPending && <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" />}Сохранить
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="mt-[var(--space-1)] self-start" onClick={() => { setAdding(true); setErr(null) }}>
              <Plus className="size-[var(--space-4)]" /> Добавить учётные данные
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
