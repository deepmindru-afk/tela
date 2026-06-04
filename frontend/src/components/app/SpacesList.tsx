import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Building2,
  Lock,
  MoreHorizontal,
  Plus,
  RotateCw,
  Users,
  UsersRound,
} from 'lucide-react'
import { ApiError } from '../../lib/api'
import {
  useDeleteSpace,
  useSpaces,
  useUpdateSpace,
} from '../../lib/queries/spaces'
import type { Space, SpacePrincipal } from '../../lib/types'
import { Button } from '../ui/button'
import { Card, CardBody, CardFooter } from '../ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { useSpaceAccess } from '../../lib/queries/space-grants'
import { cn } from '../../lib/utils'
import { NewSpaceDialog } from './NewSpaceDialog'
import { ShareSpaceDialog } from './ShareSpaceDialog'

interface SpacesListProps {
  activeSpaceId: number | null
}

export function SpacesList({ activeSpaceId }: SpacesListProps) {
  const navigate = useNavigate()
  const spaces = useSpaces()
  const [newOpen, setNewOpen] = useState(false)

  return (
    <section
      className="flex flex-col gap-[var(--space-1)] px-[var(--space-3)] pt-[var(--space-4)]"
      aria-labelledby="sidebar-spaces-heading"
    >
      <div className="flex items-center justify-between pl-[var(--space-2)] pr-[var(--space-1)]">
        <h2
          id="sidebar-spaces-heading"
          className="m-0 text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]"
        >
          Spaces
        </h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label="New space"
          onClick={() => setNewOpen(true)}
          className="h-[var(--space-7)] w-[var(--space-7)] p-0"
        >
          <Plus width={14} height={14} />
        </Button>
      </div>

      {spaces.isLoading ? <SpacesSkeleton /> : null}

      {spaces.isError ? (
        <SpacesError onRetry={() => void spaces.refetch()} />
      ) : null}

      {spaces.data && spaces.data.length === 0 ? (
        <Card className="bg-[var(--surface-1)]">
          <CardBody className="px-[var(--space-4)] py-[var(--space-3)] gap-[var(--space-1)]">
            <p className="m-0 text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
              No spaces yet
            </p>
            <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
              Create a space to get started.
            </p>
          </CardBody>
          <CardFooter className="px-[var(--space-4)] pt-0 pb-[var(--space-3)]">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => setNewOpen(true)}
            >
              <Plus width={14} height={14} /> New space
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {spaces.data?.map((space) => (
        <SpaceRow
          key={space.id}
          space={space}
          active={space.id === activeSpaceId}
          onSelect={() => {
            void navigate({ to: '/spaces/$spaceId', params: { spaceId: space.id } })
          }}
        />
      ))}

      <NewSpaceDialog open={newOpen} onOpenChange={setNewOpen} />
    </section>
  )
}

function SpacesSkeleton() {
  return (
    <div
      className="flex flex-col gap-[var(--space-1)] px-[var(--space-2)]"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[var(--space-7)] rounded-[var(--radius-sm)] bg-[var(--surface-2)]"
        />
      ))}
    </div>
  )
}

function SpacesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-[var(--space-2)] px-[var(--space-2)] py-[var(--space-2)] rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[length:var(--text-sm)] text-[var(--danger)]">
      <span>Couldn't load spaces.</span>
      <Button variant="ghost" size="sm" onClick={onRetry} aria-label="Retry">
        <RotateCw width={14} height={14} />
      </Button>
    </div>
  )
}

interface SpaceRowProps {
  space: Space
  active: boolean
  onSelect: () => void
}

function SpaceRow({ space, active, onSelect }: SpaceRowProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div
      className={cn(
        'group flex items-center gap-[var(--space-1)] px-[var(--space-2)] rounded-[var(--radius-sm)]',
        'hover:bg-[var(--surface-2)]',
        active && 'bg-[var(--surface-3)]',
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col py-[var(--space-1)]">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'min-w-0 text-left truncate',
            'font-[family-name:var(--font-sans)] text-[length:var(--text-sm)] leading-[var(--leading-tight)]',
            'text-[var(--text-primary)] bg-transparent border-0 cursor-pointer outline-none',
            active && 'text-[var(--accent)] font-medium',
          )}
        >
          {space.name || (
            <span className="text-[var(--text-muted)]">Untitled space</span>
          )}
        </button>

        {/* Access line: who/what can reach this space, at a glance. Click →
            manage access; hover → the full resolved who/what. Fires the access
            query lazily (only when the tooltip opens). */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${accessAriaLabel(space)} — manage access`}
              onClick={(e) => {
                e.stopPropagation()
                setShareOpen(true)
              }}
              className="mt-[1px] min-w-0 w-fit max-w-full text-left bg-transparent border-0 p-0 cursor-pointer outline-none rounded-[var(--radius-xs)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <AccessSummary space={space} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <SpaceAccessPeek space={space} />
          </TooltipContent>
        </Tooltip>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Actions for ${space.name || 'space'}`}
            className="shrink-0 h-[var(--space-7)] w-[var(--space-7)] p-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
          >
            <MoreHorizontal width={14} height={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <UsersRound width={14} height={14} /> Share
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameSpaceDialog
        space={space}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
      <ShareSpaceDialog
        space={space}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <DeleteSpaceDialog
        space={space}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  )
}

// isPrivateSpace — reachable only by you (not the personal home, no shares).
function isPrivateSpace(space: Space): boolean {
  return (
    !space.is_personal &&
    (space.member_count ?? 0) <= 1 &&
    (space.principals?.length ?? 0) === 0
  )
}

function accessAriaLabel(space: Space): string {
  if (space.is_personal) return 'Personal space, only you'
  if (isPrivateSpace(space)) return 'Private, only you'
  const people = space.member_count ?? 0
  const shared = (space.principals ?? []).map((p) => p.name).join(', ')
  return `${people} ${people === 1 ? 'person' : 'people'}${shared ? `, shared with ${shared}` : ''}`
}

// AccessSummary — the compact access line under a space name. Personal / Private
// collapse to a lock; shared spaces show the effective people count plus the
// orgs/groups it's shared with (first two, then +N).
function AccessSummary({ space }: { space: Space }) {
  const baseChip =
    'inline-flex items-center gap-[3px] min-w-0 text-[length:var(--text-xs)] leading-none text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'

  if (space.is_personal) {
    return (
      <span className={baseChip}>
        <Lock width={11} height={11} aria-hidden />
        <span>Personal</span>
      </span>
    )
  }
  if (isPrivateSpace(space)) {
    return (
      <span className={baseChip}>
        <Lock width={11} height={11} aria-hidden />
        <span>Private</span>
      </span>
    )
  }

  const principals = space.principals ?? []
  const shown = principals.slice(0, 2)
  const overflow = principals.length - shown.length

  return (
    <span className="flex items-center gap-[var(--space-1)] min-w-0">
      <span className={cn(baseChip, 'shrink-0')}>
        <UsersRound width={11} height={11} aria-hidden />
        <span>{space.member_count ?? 0}</span>
      </span>
      {shown.map((p) => (
        <PrincipalChip key={`${p.kind}:${p.name}`} principal={p} />
      ))}
      {overflow > 0 ? (
        <span className="shrink-0 text-[length:var(--text-xs)] leading-none text-[var(--text-muted)]">
          +{overflow}
        </span>
      ) : null}
    </span>
  )
}

function PrincipalChip({ principal }: { principal: SpacePrincipal }) {
  const Icon = principal.kind === 'group' ? Users : Building2
  return (
    <span className="inline-flex items-center gap-[3px] min-w-0 max-w-[7rem] rounded-[var(--radius-xs)] bg-[var(--surface-2)] group-hover:bg-[var(--surface-3)] px-[var(--space-1)] py-[1px] text-[length:var(--text-xs)] leading-none text-[var(--text-secondary)]">
      <Icon width={10} height={10} aria-hidden className="shrink-0" />
      <span className="truncate">{principal.name}</span>
    </span>
  )
}

// SpaceAccessPeek — the access line's hover content: the orgs/groups the space
// is shared with, then everyone who can actually open it with their effective
// role and how they reach it (direct / via <org-or-group>). Resolved lazily.
function SpaceAccessPeek({ space }: { space: Space }) {
  const access = useSpaceAccess(space.id)
  const principals = space.principals ?? []

  if (space.is_personal || isPrivateSpace(space)) {
    return (
      <span className="text-[var(--text-muted)]">
        {space.is_personal ? 'Your personal space' : 'Private'} — only you
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)] max-w-[16rem]">
      {principals.length > 0 ? (
        <div className="flex flex-col gap-[2px]">
          <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)]">
            Shared with
          </span>
          {principals.map((p) => (
            <span key={`${p.kind}:${p.name}`} className="flex items-center gap-[var(--space-1)]">
              {p.kind === 'group' ? (
                <Users width={11} height={11} aria-hidden />
              ) : (
                <Building2 width={11} height={11} aria-hidden />
              )}
              <span className="truncate">{p.name}</span>
              <span className="text-[var(--text-muted)]">
                {p.kind === 'group' ? 'group' : 'org'}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-[2px]">
        <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)]">
          {access.data ? `People (${access.data.length})` : 'People'}
        </span>
        {access.isLoading ? (
          <span className="text-[var(--text-muted)]">Loading…</span>
        ) : (
          (access.data ?? []).slice(0, 8).map((p) => (
            <div key={p.user_id} className="flex items-center justify-between gap-[var(--space-3)]">
              <span className="truncate">{p.username}</span>
              <span className="shrink-0 text-[var(--text-muted)] capitalize">
                {p.effective_role}
                {peekVia(p.sources) ? ` · ${peekVia(p.sources)}` : ''}
              </span>
            </div>
          ))
        )}
        {(access.data?.length ?? 0) > 8 ? (
          <span className="text-[var(--text-muted)]">
            +{(access.data?.length ?? 0) - 8} more
          </span>
        ) : null}
      </div>
    </div>
  )
}

// peekVia — compact provenance for the tooltip: "direct" or "via Acme".
function peekVia(sources: { kind: string; name?: string }[]): string {
  if (sources.some((s) => s.kind === 'direct')) return 'direct'
  const name = sources.find((s) => s.kind !== 'direct' && s.name)?.name
  return name ? `via ${name}` : ''
}

interface RenameSpaceDialogProps {
  space: Space
  open: boolean
  onOpenChange: (next: boolean) => void
}

function RenameSpaceDialog({ space, open, onOpenChange }: RenameSpaceDialogProps) {
  const [name, setName] = useState(space.name)
  const [error, setError] = useState<string | null>(null)
  const updateSpace = useUpdateSpace()

  function handleClose(next: boolean) {
    if (!next) {
      setName(space.name)
      setError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    if (trimmed === space.name) {
      handleClose(false)
      return
    }
    setError(null)
    try {
      await updateSpace.mutateAsync({ id: space.id, name: trimmed })
      handleClose(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to rename space.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename space</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-3)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <label
              htmlFor={`rename-space-${space.id}`}
              className="text-[length:var(--text-sm)] text-[var(--text-muted)]"
            >
              Name
            </label>
            <Input
              id={`rename-space-${space.id}`}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error != null}
            />
            {error ? (
              <p className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={updateSpace.isPending}>
              {updateSpace.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteSpaceDialogProps {
  space: Space
  open: boolean
  onOpenChange: (next: boolean) => void
}

function DeleteSpaceDialog({
  space,
  open,
  onOpenChange,
}: DeleteSpaceDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const deleteSpace = useDeleteSpace()
  const spaces = useSpaces()

  function handleClose(next: boolean) {
    if (!next) setError(null)
    onOpenChange(next)
  }

  async function handleDelete() {
    setError(null)
    try {
      await deleteSpace.mutateAsync(space.id)
      handleClose(false)
      // Route to another space if available, otherwise to the empty landing.
      const remaining = spaces.data?.filter((s) => s.id !== space.id) ?? []
      if (remaining.length > 0) {
        void navigate({
          to: '/spaces/$spaceId',
          params: { spaceId: remaining[0].id },
        })
      } else {
        void navigate({ to: '/' })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete space.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this space?</DialogTitle>
          <DialogDescription>
            "{space.name}" and all of its pages will be permanently removed. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={deleteSpace.isPending}
          >
            {deleteSpace.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
