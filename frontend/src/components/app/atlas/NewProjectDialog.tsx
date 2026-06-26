import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import { type AtlasCadence, type AtlasOwner, useCreateProject } from '../../../lib/queries/atlas'

const CADENCES: { value: AtlasCadence; label: string }[] = [
  { value: '', label: 'Manual — I run it' },
  { value: 'hourly', label: 'Automatic · hourly' },
  { value: 'daily', label: 'Automatic · daily' },
  { value: 'weekly', label: 'Automatic · weekly' },
  { value: 'monthly', label: 'Automatic · monthly' },
]

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
  const [name, setName] = useState('')
  const [ownerIdx, setOwnerIdx] = useState(0)
  const [spaceName, setSpaceName] = useState('')
  const [spaceTouched, setSpaceTouched] = useState(false)
  const [cadence, setCadence] = useState<AtlasCadence>('')
  const [err, setErr] = useState<string | null>(null)

  // Reset on open; default the output space to the project name until edited.
  useEffect(() => {
    if (open) {
      setName('')
      setOwnerIdx(0)
      setSpaceName('')
      setSpaceTouched(false)
      setCadence('')
      setErr(null)
    }
  }, [open])
  const effectiveSpace = spaceTouched ? spaceName : name

  const owner = owners[ownerIdx]
  const canSubmit = useMemo(
    () => name.trim().length > 0 && effectiveSpace.trim().length > 0 && owner != null && !create.isPending,
    [name, effectiveSpace, owner, create.isPending],
  )

  async function submit() {
    if (!owner) return
    setErr(null)
    try {
      const { project } = await create.mutateAsync({
        name: name.trim(),
        owner_kind: owner.kind,
        owner_id: owner.id,
        output: { new_space_name: effectiveSpace.trim() },
        cadence,
        auto_update: cadence !== '',
      })
      onOpenChange(false)
      navigate({ to: '/atlas/projects/$projectId', params: { projectId: project.id } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the project.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Atlas project</DialogTitle>
          <DialogDescription>
            A project bundles sources into one output space. You'll add the repos / Jira projects next, then run it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]">
          <Field label="Project name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="compass" autoFocus />
          </Field>

          {owners.length > 1 && (
            <Field label="Owner" hint="Who manages it — you, or an org's admins.">
              <Select value={String(ownerIdx)} onChange={(e) => setOwnerIdx(Number(e.target.value))}>
                {owners.map((o, i) => (
                  <option key={`${o.kind}:${o.id}`} value={i}>
                    {o.kind === 'user' ? `${o.name} (personal)` : `${o.name} (org)`}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Output space" hint="Created on the first run if it doesn't exist; re-point it later in settings.">
            <Input
              value={effectiveSpace}
              onChange={(e) => {
                setSpaceTouched(true)
                setSpaceName(e.target.value)
              }}
              placeholder="compass"
            />
          </Field>

          <Field label="Refresh">
            <Select value={cadence} onChange={(e) => setCadence(e.target.value as AtlasCadence)}>
              {CADENCES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>

          {err && <p className="text-[length:var(--text-sm)] text-[var(--accent-negative-fg)]">{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            {create.isPending && <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[var(--space-1)]">
      <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">{label}</span>
      {children}
      {hint && <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{hint}</span>}
    </label>
  )
}
