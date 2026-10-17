import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Building2, Globe, Lock, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { useMe } from '../../lib/queries/auth'
import {
  useAddSpaceMember,
  useRemoveSpaceMember,
  useSpaceMembers,
  useUpdateSpaceMember,
} from '../../lib/queries/members'
import { useSpaceRole, useTransferSpace, useUpdateSpace } from '../../lib/queries/spaces'
import { useOrgs } from '../../lib/queries/orgs'
import {
  useRevokeSpaceInvite,
  useShareSpaceByEmail,
  useSpaceInvites,
} from '../../lib/queries/invites'
import { useMyGroups } from '../../lib/queries/groups'
import {
  useAddSpaceGrant,
  useRemoveSpaceGrant,
  useSpaceAccess,
  useSpaceGrants,
  useUpdateSpaceGrant,
} from '../../lib/queries/space-grants'
import type {
  AccessSource,
  Org,
  Space,
  SpaceGrant,
  SpaceMember,
} from '../../lib/types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { TextArea } from '../ui/textarea'
import { Select } from '../ui/select'
import { UserPicker } from './UserPicker'
import type { MentionUser } from '../../lib/queries/users'
import { cn } from '../../lib/utils'
import { spaceOwnership } from '../../lib/space-owner'

const ROLE_LABEL: Record<SpaceMember['role'], string> = {
  owner: 'Владелец',
  editor: 'Редактор',
  viewer: 'Наблюдатель',
}

interface ShareSpaceDialogProps {
  space: Space
  open: boolean
  onOpenChange: (next: boolean) => void
}

export function ShareSpaceDialog({
  space,
  open,
  onOpenChange,
}: ShareSpaceDialogProps) {
  const me = useMe()
  const members = useSpaceMembers(open ? space.id : null)
  const { isOwner: iAmOwner } = useSpaceRole(open ? space.id : null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Поделиться «{space.name}»</DialogTitle>
          <DialogDescription>
            Участники этого пространства могут просматривать его страницы.
            Владельцы могут менять роли и приглашать новых участников.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-4)]">
          <OwnedByLine space={space} />

          {open ? <SpaceAccessSummary spaceId={space.id} /> : null}

          <div className="flex flex-col gap-[var(--space-2)] pt-[var(--space-3)] border-t border-[var(--border-subtle)]">
            <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
              Прямые участники
            </span>
          {members.isLoading ? (
            <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
              Загрузка участников…
            </p>
          ) : members.isError ? (
            <p
              role="alert"
              className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]"
            >
              Не удалось загрузить участников.
            </p>
          ) : members.data && members.data.length > 0 ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
              {members.data.map((member) => (
                <MemberRow
                  key={member.user_id}
                  space={space}
                  member={member}
                  isSelf={me.data?.id === member.user_id}
                  iAmOwner={iAmOwner}
                  onSelfLeave={() => onOpenChange(false)}
                />
              ))}
            </ul>
          ) : null}

          {iAmOwner ? (
            <>
              <AddMemberForm spaceId={space.id} />
              {open ? <PendingInvites spaceId={space.id} /> : null}
            </>
          ) : null}
          </div>

          {open ? <SpaceOrgGrants space={space} iAmOwner={iAmOwner} /> : null}

          <PublicAccessSection space={space} iAmOwner={iAmOwner} />

          {iAmOwner ? <TransferOwnershipSection space={space} /> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Закрыть
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Ownership at a glance — the account this space belongs to (an org vs you),
// which the rest of the dialog (members, grants, transfer) never states
// outright. Org-owned shows a Building2; personal/you stays an unadorned line.
function OwnedByLine({ space }: { space: Space }) {
  const owner = spaceOwnership(space)
  return (
    <p className="m-0 flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
      {owner.kind === 'org' ? (
        <Building2
          width={14}
          height={14}
          aria-hidden
          className="shrink-0 text-[var(--text-muted)]"
        />
      ) : null}
      <span>
        {owner.kind === 'org' ? (
          <>
            Принадлежит{' '}
            <span className="font-medium text-[var(--text-primary)]">
              {owner.org}
            </span>
          </>
        ) : owner.kind === 'personal' ? (
          'Личное пространство'
        ) : (
          <>
            Принадлежит{' '}
            <span className="font-medium text-[var(--text-primary)]">вам</span>
          </>
        )}
      </span>
    </p>
  )
}

interface MemberRowProps {
  space: Space
  member: SpaceMember
  isSelf: boolean
  iAmOwner: boolean
  onSelfLeave: () => void
}

function MemberRow({
  space,
  member,
  isSelf,
  iAmOwner,
  onSelfLeave,
}: MemberRowProps) {
  const [rowError, setRowError] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const updateMember = useUpdateSpaceMember()
  const removeMember = useRemoveSpaceMember()

  const canEditRole = iAmOwner && !isSelf

  async function handleRoleChange(role: SpaceMember['role']) {
    if (role === member.role) return
    setRowError(null)
    try {
      await updateMember.mutateAsync({
        spaceId: space.id,
        userId: member.user_id,
        role,
      })
    } catch (err) {
      setRowError(memberErrorMessage(err))
    }
  }

  async function handleRemove() {
    setRowError(null)
    try {
      await removeMember.mutateAsync({
        spaceId: space.id,
        userId: member.user_id,
      })
    } catch (err) {
      setRowError(memberErrorMessage(err))
    }
  }

  return (
    <li
      className={cn(
        'm-0 list-none',
        'flex items-center gap-[var(--space-3)]',
        'px-[var(--space-3)] py-[var(--space-2)]',
        'rounded-[var(--radius-sm)]',
        'border border-[var(--border-subtle)] bg-[var(--surface-1)]',
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
        <div className="flex items-center gap-[var(--space-2)] min-w-0 flex-wrap">
          <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium font-[family-name:var(--font-sans)]">
            {member.username}
          </span>
          {isSelf ? <Badge variant="muted">Вы</Badge> : null}
        </div>
        {rowError ? (
          <span
            role="alert"
            className="text-[length:var(--text-xs)] text-[var(--danger)]"
          >
            {rowError}
          </span>
        ) : null}
      </div>

      {canEditRole ? (
        <div className="w-[6.5rem] shrink-0">
          <Select
            size="sm"
            aria-label={`Роль для ${member.username}`}
            value={member.role}
            disabled={updateMember.isPending}
            onChange={(e) =>
              void handleRoleChange(e.target.value as SpaceMember['role'])
            }
          >
            <option value="owner">Владелец</option>
            <option value="editor">Редактор</option>
            <option value="viewer">Наблюдатель</option>
          </Select>
        </div>
      ) : (
        <Badge variant={member.role === 'owner' ? 'accent' : 'muted'}>
          {ROLE_LABEL[member.role]}
        </Badge>
      )}

      {iAmOwner && !isSelf ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Удалить ${member.username}`}
          onClick={() => void handleRemove()}
          disabled={removeMember.isPending}
          className="text-[var(--text-muted)] hover:text-[var(--danger)]"
        >
          <Trash2 width={14} height={14} />
        </Button>
      ) : null}

      {!iAmOwner && isSelf ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLeaveOpen(true)}
          >
            Покинуть пространство
          </Button>
          <LeaveSpaceConfirmDialog
            space={space}
            open={leaveOpen}
            onOpenChange={setLeaveOpen}
            onLeft={onSelfLeave}
          />
        </>
      ) : null}
    </li>
  )
}

interface LeaveSpaceConfirmDialogProps {
  space: Space
  open: boolean
  onOpenChange: (next: boolean) => void
  onLeft: () => void
}

function LeaveSpaceConfirmDialog({
  space,
  open,
  onOpenChange,
  onLeft,
}: LeaveSpaceConfirmDialogProps) {
  const me = useMe()
  const navigate = useNavigate()
  const removeMember = useRemoveSpaceMember()
  const [error, setError] = useState<string | null>(null)

  function handleClose(next: boolean) {
    if (!next) setError(null)
    onOpenChange(next)
  }

  async function handleConfirm() {
    if (me.data == null) return
    setError(null)
    try {
      await removeMember.mutateAsync({
        spaceId: space.id,
        userId: me.data.id,
        isSelf: true,
      })
      handleClose(false)
      onLeft()
      void navigate({ to: '/' })
    } catch (err) {
      setError(memberErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Покинуть «{space.name}»?</DialogTitle>
          <DialogDescription>
            Вы потеряете доступ к этому пространству и его страницам. Чтобы
            вернуться, владельцу нужно будет снова пригласить вас.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p
            role="alert"
            className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Отмена
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            onClick={() => void handleConfirm()}
            disabled={removeMember.isPending}
          >
            {removeMember.isPending ? 'Выход…' : 'Покинуть пространство'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// One control, two ways in: pick someone who already has an account, or type
// an email address for someone who doesn't. Typing a full address the directory
// doesn't know offers an "invite" row in the same picker (see UserPicker), so
// this reads as a single "share with a person" action — the backend then either
// grants access straight away (the address has an account) or emails an
// invitation that lands the moment they sign up.
function AddMemberForm({ spaceId }: { spaceId: number }) {
  const [user, setUser] = useState<MentionUser | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<SpaceMember['role']>('viewer')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<string | null>(null)
  const addMember = useAddSpaceMember()
  const shareByEmail = useShareSpaceByEmail(spaceId)
  const members = useSpaceMembers(spaceId)
  const busy = addMember.isPending || shareByEmail.isPending

  function reset() {
    setUser(null)
    setEmail(null)
    setRole('viewer')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user && !email) {
      setError('Выберите человека или введите адрес электронной почты для приглашения.')
      return
    }
    setError(null)
    setOutcome(null)
    try {
      if (email) {
        const res = await shareByEmail.mutateAsync({ email, role })
        setOutcome(
          res.member
            ? `Общий доступ предоставлен: ${res.member.username}.`
            : `Приглашение отправлено на ${email}.`,
        )
      } else if (user) {
        await addMember.mutateAsync({ spaceId, username: user.username, role })
        setOutcome(`Общий доступ предоставлен: ${user.username}.`)
      }
      reset()
    } catch (err) {
      setError(addMemberErrorMessage(err))
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn(
        'flex flex-col gap-[var(--space-2)]',
        'pt-[var(--space-3)]',
        'border-t border-[var(--border-subtle)]',
      )}
    >
      <label
        htmlFor={`add-member-username-${spaceId}`}
        className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]"
      >
        Поделиться с человеком
      </label>
      <div className="flex items-start gap-[var(--space-2)]">
        <div className="flex-1 min-w-0">
          <UserPicker
            id={`add-member-username-${spaceId}`}
            placeholder="Поиск людей или введите адрес…"
            value={user}
            onChange={(u) => {
              setUser(u)
              setEmail(null)
              setError(null)
            }}
            emailValue={email}
            onInviteEmail={(addr) => {
              setEmail(addr)
              setUser(null)
              setError(null)
            }}
            inviteHint="Пригласить по электронной почте"
            invalid={error != null}
            excludeIds={(members.data ?? []).map((m) => m.user_id)}
          />
        </div>
        <div className="w-[6.5rem] shrink-0">
          <Select
            size="md"
            aria-label="Роль нового участника"
            value={role}
            onChange={(e) => setRole(e.target.value as SpaceMember['role'])}
          >
            <option value="owner">Владелец</option>
            <option value="editor">Редактор</option>
            <option value="viewer">Наблюдатель</option>
          </Select>
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={busy || (user == null && email == null)}
        >
          {email ? (
            <Mail width={14} height={14} />
          ) : (
            <UserPlus width={14} height={14} />
          )}
          <span>
            {busy ? 'Отправка…' : email ? 'Пригласить' : 'Добавить'}
          </span>
        </Button>
      </div>
      <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
        Ещё нет аккаунта? Введите адрес электронной почты — сразу после
        регистрации они получат приглашение и доступ к этому пространству.
      </p>
      {outcome ? (
        <p
          role="status"
          className="m-0 text-[length:var(--text-xs)] text-[var(--accent)]"
        >
          {outcome}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}

// Invitations sent to addresses that have no tela account yet — they're not
// members until they sign up, so they'd otherwise be invisible. Owner-only
// (the endpoint is too).
function PendingInvites({ spaceId }: { spaceId: number }) {
  const invites = useSpaceInvites(spaceId)
  const revoke = useRevokeSpaceInvite(spaceId)
  const [error, setError] = useState<string | null>(null)

  const list = invites.data ?? []
  if (list.length === 0) return null

  async function handleRevoke(id: number) {
    setError(null)
    try {
      await revoke.mutateAsync(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отозвать приглашение.')
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)] pt-[var(--space-3)]">
      <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
        Приглашения в ожидании
      </span>
      <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
        {list.map((inv) => (
          <li
            key={inv.id}
            className={cn(
              'm-0 list-none flex items-center gap-[var(--space-3)]',
              'px-[var(--space-3)] py-[var(--space-2)]',
              'rounded-[var(--radius-sm)]',
              'border border-dashed border-[var(--border-subtle)]',
            )}
          >
            <Mail
              width={13}
              height={13}
              aria-hidden
              className="shrink-0 text-[var(--text-muted)]"
            />
            <div className="flex-1 min-w-0 flex flex-col gap-[1px]">
              <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
                {inv.email}
              </span>
              <span className="truncate text-[length:var(--text-xs)] text-[var(--text-muted)]">
                Приглашён — присоединится как {ROLE_LABEL[inv.role].toLowerCase()} после
                регистрации
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Отозвать приглашение для ${inv.email}`}
              onClick={() => void handleRevoke(inv.id)}
              disabled={revoke.isPending}
              className="text-[var(--text-muted)] hover:text-[var(--danger)]"
            >
              <Trash2 width={14} height={14} />
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const GRANT_ROLE_LABEL: Record<SpaceGrant['role'], string> = {
  editor: 'Редактор',
  viewer: 'Наблюдатель',
}

// The authoritative answer to "who can access this space, and why" — resolves
// direct members + everyone reached via an org into one list with each person's
// effective (max) role and provenance. Read-only; editing happens in the
// Direct members / Organizations sections below. Reconciles the sidebar access
// count with what's actually shown.
function SpaceAccessSummary({ spaceId }: { spaceId: number }) {
  const access = useSpaceAccess(spaceId)
  const people = access.data ?? []

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
        Участники с доступом{people.length > 0 ? ` (${people.length})` : ''}
      </span>
      {access.isLoading ? (
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Определение доступа…
        </p>
      ) : access.isError ? (
        <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Не удалось определить доступ.
        </p>
      ) : people.length > 0 ? (
        <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
          {people.map((p) => (
            <li
              key={p.user_id}
              className="m-0 list-none flex items-center gap-[var(--space-3)] px-[var(--space-2)] py-[var(--space-1)]"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-[1px]">
                <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
                  {p.username}
                </span>
                <span className="truncate text-[length:var(--text-xs)] text-[var(--text-muted)]">
                  {provenanceLabel(p.sources)}
                </span>
              </div>
              <Badge variant={p.effective_role === 'owner' ? 'accent' : 'muted'}>
                {ROLE_LABEL[p.effective_role]}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

// "Direct" and/or "via <Org/Group>, …" — explains every route a person has in.
function provenanceLabel(sources: AccessSource[]): string {
  const parts: string[] = []
  if (sources.some((s) => s.kind === 'direct')) parts.push('Прямой доступ')
  const vias = sources
    .filter((s) => s.kind !== 'direct' && s.name)
    .map((s) => s.name as string)
  if (vias.length > 0) parts.push(`через ${vias.join(', ')}`)
  return parts.join(' · ')
}

// Principal grants: share the whole space with an org or a group so every
// member gets access. The list is readable by any member; only owners get the
// controls.
function SpaceOrgGrants({
  space,
  iAmOwner,
}: {
  space: Space
  iAmOwner: boolean
}) {
  const grants = useSpaceGrants(space.id)

  // Nothing to show to non-owners when there are no grants yet — keeps the
  // dialog quiet for plain spaces.
  if (!iAmOwner && (grants.data == null || grants.data.length === 0)) {
    return null
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)] pt-[var(--space-3)] border-t border-[var(--border-subtle)]">
      <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
        Организации и группы
      </span>

      {grants.isError ? (
        <p role="alert" className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">
          Не удалось загрузить общий доступ.
        </p>
      ) : grants.data && grants.data.length > 0 ? (
        <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
          {grants.data.map((grant) => (
            <GrantRow
              key={grant.id}
              spaceId={space.id}
              grant={grant}
              iAmOwner={iAmOwner}
            />
          ))}
        </ul>
      ) : null}

      {iAmOwner ? (
        <AddGrantForm spaceId={space.id} granted={grants.data ?? []} />
      ) : null}
    </div>
  )
}

function GrantRow({
  spaceId,
  grant,
  iAmOwner,
}: {
  spaceId: number
  grant: SpaceGrant
  iAmOwner: boolean
}) {
  const [rowError, setRowError] = useState<string | null>(null)
  const updateGrant = useUpdateSpaceGrant()
  const removeGrant = useRemoveSpaceGrant()

  async function handleRoleChange(role: SpaceGrant['role']) {
    if (role === grant.role) return
    setRowError(null)
    try {
      await updateGrant.mutateAsync({ spaceId, grantId: grant.id, role })
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : 'Что-то пошло не так.')
    }
  }

  async function handleRemove() {
    setRowError(null)
    try {
      await removeGrant.mutateAsync({ spaceId, grantId: grant.id })
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : 'Что-то пошло не так.')
    }
  }

  return (
    <li
      className={cn(
        'm-0 list-none flex items-center gap-[var(--space-3)]',
        'px-[var(--space-3)] py-[var(--space-2)]',
        'rounded-[var(--radius-sm)]',
        'border border-[var(--border-subtle)] bg-[var(--surface-1)]',
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
        <div className="flex items-center gap-[var(--space-2)] min-w-0">
          {grant.principal_kind === 'group' ? (
            <Users width={13} height={13} className="text-[var(--text-muted)] shrink-0" />
          ) : (
            <Building2 width={13} height={13} className="text-[var(--text-muted)] shrink-0" />
          )}
          <span className="truncate text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium font-[family-name:var(--font-sans)]">
            {grant.principal_name}
          </span>
        </div>
        <span className="truncate text-[length:var(--text-xs)] text-[var(--text-muted)]">
          {grant.principal_kind === 'group'
            ? `Группа${grant.context_name ? ` · ${grant.context_name}` : ''}`
            : 'Организация'}
        </span>
        {rowError ? (
          <span role="alert" className="text-[length:var(--text-xs)] text-[var(--danger)]">
            {rowError}
          </span>
        ) : null}
      </div>

      {iAmOwner ? (
        <div className="w-[6.5rem] shrink-0">
          <Select
            size="sm"
            aria-label={`Роль для ${grant.principal_name}`}
            value={grant.role}
            disabled={updateGrant.isPending}
            onChange={(e) => void handleRoleChange(e.target.value as SpaceGrant['role'])}
          >
            <option value="editor">Редактор</option>
            <option value="viewer">Наблюдатель</option>
          </Select>
        </div>
      ) : (
        <Badge variant="muted">{GRANT_ROLE_LABEL[grant.role]}</Badge>
      )}

      {iAmOwner ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Удалить ${grant.principal_name}`}
          onClick={() => void handleRemove()}
          disabled={removeGrant.isPending}
          className="text-[var(--text-muted)] hover:text-[var(--danger)]"
        >
          <Trash2 width={14} height={14} />
        </Button>
      ) : null}
    </li>
  )
}

function AddGrantForm({
  spaceId,
  granted,
}: {
  spaceId: number
  granted: SpaceGrant[]
}) {
  const orgs = useOrgs()
  const groups = useMyGroups()
  // Encoded principal: "org:<id>" / "group:<id>".
  const [principal, setPrincipal] = useState('')
  const [role, setRole] = useState<SpaceGrant['role']>('viewer')
  const [error, setError] = useState<string | null>(null)
  const addGrant = useAddSpaceGrant()

  const grantedKeys = new Set(
    granted.map((g) => `${g.principal_kind}:${g.principal_id}`),
  )
  const orgOptions = (orgs.data ?? []).filter(
    (o) => !grantedKeys.has(`org:${o.id}`),
  )
  const groupOptions = (groups.data ?? []).filter(
    (g) => !grantedKeys.has(`group:${g.id}`),
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (principal === '') {
      setError('Выберите организацию или группу, которым предоставить доступ.')
      return
    }
    const [kind, idStr] = principal.split(':')
    setError(null)
    try {
      await addGrant.mutateAsync({
        spaceId,
        principal_kind: kind as SpaceGrant['principal_kind'],
        principal_id: Number(idStr),
        role,
      })
      setPrincipal('')
      setRole('viewer')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('У этой организации или группы уже есть доступ.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Не удалось предоставить доступ.')
      }
    }
  }

  // Nothing left to offer — stay quiet rather than show an empty picker.
  if (orgOptions.length === 0 && groupOptions.length === 0) {
    return null
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[var(--space-2)]">
      <div className="flex items-start gap-[var(--space-2)]">
        <div className="flex-1 min-w-0">
          <Select
            size="md"
            aria-label="Организация или группа для доступа"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          >
            <option value="">Предоставить доступ организации или группе…</option>
            {orgOptions.length > 0 ? (
              <optgroup label="Организации">
                {orgOptions.map((o) => (
                  <option key={`org:${o.id}`} value={`org:${o.id}`}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {groupOptions.length > 0 ? (
              <optgroup label="Группы">
                {groupOptions.map((g) => (
                  <option key={`group:${g.id}`} value={`group:${g.id}`}>
                    {g.name} — {g.org_name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </div>
        <div className="w-[6.5rem] shrink-0">
          <Select
            size="md"
            aria-label="Роль"
            value={role}
            onChange={(e) => setRole(e.target.value as SpaceGrant['role'])}
          >
            <option value="editor">Редактор</option>
            <option value="viewer">Наблюдатель</option>
          </Select>
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={addGrant.isPending || principal === ''}
        >
          <span>{addGrant.isPending ? 'Отправка…' : 'Поделиться'}</span>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </form>
  )
}

function memberErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'last_owner') {
      return "Нельзя удалить последнего владельца — сначала назначьте владельцем другого участника."
    }
    return err.message
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.'
}

function addMemberErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'Пользователь не найден.'
    if (err.status === 409) return 'У этого человека уже есть доступ.'
    if (err.code === 'bad_request') return err.message
    return err.message
  }
  return 'Не удалось предоставить доступ.'
}

// PublicAccessSection — the Axis-2 space-level "publish to the web" control. A
// public space is readable by anyone with no login (docs/public-spaces.md).
// State is visible to every member (so anyone can tell the space is public);
// only an owner can flip it.
function PublicAccessSection({
  space,
  iAmOwner,
}: {
  space: Space
  iAmOwner: boolean
}) {
  const updateSpace = useUpdateSpace()
  const [error, setError] = useState<string | null>(null)
  const isPublic = space.visibility === 'public'
  // The server derives the canonical /{handle}/{space-slug} (org slug vs personal
  // username), so we never re-implement that rule here. Fall back to the id form
  // if it's absent — an ownerless space, or a stale cached space object.
  const publicHref = space.public_path || `/public/spaces/${space.id}`

  async function toggle() {
    setError(null)
    try {
      await updateSpace.mutateAsync({
        id: space.id,
        visibility: isPublic ? 'private' : 'public',
      })
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось изменить видимость.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)] pt-[var(--space-3)] border-t border-[var(--border-subtle)]">
      <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
        Публичный доступ
      </span>
      <div className="flex items-start gap-[var(--space-3)]">
        <span
          className="mt-[2px] text-[var(--text-muted)]"
          aria-hidden
        >
          {isPublic ? <Globe size="1.1em" /> : <Lock size="1.1em" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-primary)]">
            {isPublic ? 'Доступен в интернете' : 'Только участники'}
          </p>
          <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
            {isPublic
              ? 'Любой может читать все страницы этого пространства — без входа. Редактирование доступно только участникам.'
              : 'Это пространство могут читать только участники.'}
          </p>
          {isPublic ? (
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-[var(--space-1)] inline-block truncate text-[length:var(--text-xs)] text-[var(--accent)] no-underline hover:underline"
            >
              {`${window.location.origin}${publicHref}`}
            </a>
          ) : null}
        </div>
        {iAmOwner ? (
          <Button
            type="button"
            variant={isPublic ? 'ghost' : 'primary'}
            size="sm"
            onClick={() => void toggle()}
            disabled={updateSpace.isPending}
          >
            {isPublic ? 'Сделать приватным' : 'Сделать публичным'}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      {isPublic && iAmOwner ? <BlogDescriptionField space={space} /> : null}
    </div>
  )
}

// Owner-only: hand the whole space to an organization. The space keeps its
// human owner row; the org gets it as its owning account (and editor access).
// Picks a target org, then confirms before the irreversible-feeling move.
function TransferOwnershipSection({ space }: { space: Space }) {
  const orgs = useOrgs()
  const [orgId, setOrgId] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const orgOptions = orgs.data ?? []
  const targetOrg = orgOptions.find((o) => String(o.id) === orgId)

  // No orgs to transfer into — stay quiet rather than show an empty picker.
  if (orgOptions.length === 0) return null

  return (
    <div className="flex flex-col gap-[var(--space-2)] pt-[var(--space-3)] border-t border-[var(--border-subtle)]">
      <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
        Передать владение организацией
      </span>
      <p className="m-0 text-[length:var(--text-xs)] text-[var(--text-muted)]">
        Организация станет владельцем этого пространства и получит права
        редактора. Вы останетесь владельцем.
      </p>
      <div className="flex items-start gap-[var(--space-2)]">
        <div className="flex-1 min-w-0">
          <Select
            size="md"
            aria-label="Организация для передачи"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            <option value="">Выберите организацию…</option>
            {orgOptions.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={orgId === ''}
          onClick={() => setConfirmOpen(true)}
        >
          <Building2 width={14} height={14} />
          <span>Передать</span>
        </Button>
      </div>
      {targetOrg ? (
        <TransferConfirmDialog
          space={space}
          org={targetOrg}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onTransferred={() => setOrgId('')}
        />
      ) : null}
    </div>
  )
}

function TransferConfirmDialog({
  space,
  org,
  open,
  onOpenChange,
  onTransferred,
}: {
  space: Space
  org: Org
  open: boolean
  onOpenChange: (next: boolean) => void
  onTransferred: () => void
}) {
  const transfer = useTransferSpace()
  const [error, setError] = useState<string | null>(null)

  function handleClose(next: boolean) {
    if (!next) setError(null)
    onOpenChange(next)
  }

  async function handleConfirm() {
    setError(null)
    try {
      await transfer.mutateAsync({ id: space.id, org_id: org.id })
      handleClose(false)
      onTransferred()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось передать.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Передать «{space.name}» организации {org.name}?</DialogTitle>
          <DialogDescription>
            {org.name} станет владельцем этого пространства и получит права
            редактора. Вы останетесь его владельцем.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Отмена
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={transfer.isPending}
          >
            {transfer.isPending ? 'Передача…' : 'Передать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The blog standfirst for a public space — shown under the space name on its
// front page. Owner-edited inline here, saved on blur when it changed.
function BlogDescriptionField({ space }: { space: Space }) {
  const updateSpace = useUpdateSpace()
  const [value, setValue] = useState(space.description ?? '')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const next = value.trim()
    if (next === (space.description ?? '')) return
    setError(null)
    try {
      await updateSpace.mutateAsync({ id: space.id, description: next })
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось сохранить описание.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-1)] pl-[calc(1.1em+var(--space-3))]">
      <label
        htmlFor={`blog-desc-${space.id}`}
        className="text-[length:var(--text-xs)] text-[var(--text-muted)]"
      >
        Описание блога
      </label>
      <TextArea
        id={`blog-desc-${space.id}`}
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 280))}
        onBlur={() => void save()}
        rows={2}
        placeholder="Строка, представляющая этот блог, — показывается под его заголовком."
        size="sm"
        font="sans"
      />
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
          {updateSpace.isPending ? 'Сохранение…' : 'Показывается на главной странице'}
        </span>
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
          {value.length}/280
        </span>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
