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

  // Only credentials owned by this project's owner and matching the source type.
  const creds = useMemo(
    () => (credsQ.data?.credentials ?? []).filter((c) => c.owner_kind === owner.kind && c.owner_id === owner.id && c.kind === type),
    [credsQ.data, owner, type],
  )
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
      setErr(e instanceof Error ? e.message : 'Could not add the source.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add source</DialogTitle>
          <DialogDescription>
            Its docs land under a folder named after it, inside the project's output space.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]">
          <div className="grid grid-cols-[8rem_1fr] gap-[var(--space-3)]">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as AtlasSourceType)}>
                <option value="git">Git repo</option>
                <option value="jira">Jira project</option>
              </Select>
            </Field>
            <Field label={type === 'git' ? 'Repository URL' : 'Jira base · project key'}>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={type === 'git' ? 'https://github.com/org/repo' : 'https://org.atlassian.net · PROJ'} autoFocus />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <Field label="Name" hint="Folder name in the space.">
              <Input value={effectiveName} onChange={(e) => { setNameTouched(true); setName(e.target.value) }} placeholder="repo" />
            </Field>
            {type === 'git' && (
              <Field label="Branch" hint="Default branch if blank.">
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
              </Field>
            )}
          </div>

          {type === 'git' && (
            <Field label="Subpath" hint="Restrict to a directory (optional).">
              <Input value={subpath} onChange={(e) => setSubpath(e.target.value)} placeholder="packages/core" />
            </Field>
          )}

          <Field label="Credential" hint={creds.length === 0 ? 'None needed for public repos. Add one under Credentials for private sources.' : 'Reused across sources with the same owner.'}>
            <Select value={credId} onChange={(e) => setCredId(e.target.value)} disabled={creds.length === 0}>
              <option value="">{type === 'git' ? 'Public — no credential' : 'None'}</option>
              {creds.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>

          {err && <p className="text-[length:var(--text-sm)] text-[var(--accent-negative-fg)]">{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!location.trim() || create.isPending} onClick={submit}>
            {create.isPending && <Loader2 className="size-[var(--space-4)] motion-safe:animate-spin" />}Add source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
