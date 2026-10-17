import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useInvite, useAcceptInvite } from '../lib/queries/invites'
import { useMe } from '../lib/queries/auth'
import { ApiError } from '../lib/api'
import { Button } from '../components/ui/button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { AuthShell } from '../components/app/AuthShell'

function Shell({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <AuthShell>
      <Card className="tela-auth-card w-full bg-[var(--surface-1)] shadow-[var(--shadow-lg)] text-center">
        <CardHeader className="items-center">
          <CardTitle className="text-[length:var(--text-2xl)]">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        {children ? <CardBody>{children}</CardBody> : null}
      </Card>
    </AuthShell>
  )
}

// One page for both invite kinds — an organization (self-serve teams) and a
// single space (share-by-email). The backend's `kind` discriminator decides the
// wording; the flows (accept while signed in, sign up and auto-join on verify,
// wrong-account) are identical.
export function InvitePage() {
  const { token } = useParams({ from: '/invite/$token' })
  const invite = useInvite(token)
  const me = useMe()
  const accept = useAcceptInvite()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  if (invite.isPending || me.isPending) {
    return <Shell title="Загрузка приглашения…" description="Одну минуту." />
  }
  const data = invite.data
  if (!data || !data.valid) {
    return (
      <Shell
        title="Приглашение недействительно или истекло"
        description="Это приглашение нельзя использовать. Попросите команду прислать новое."
      >
        <Button asChild variant="primary" size="lg">
          <Link to="/login">Перейти в сервис tela</Link>
        </Button>
      </Shell>
    )
  }

  const isSpace = data.kind === 'space'
  // What you're joining, and the noun for it.
  const target = (isSpace ? data.space_name : data.org_name) ?? (isSpace ? 'пространству' : 'команде')
  const what = isSpace ? `пространство «${target}»` : target
  const invitedBy = data.inviter
    ? `${data.inviter} приглашает вас в ${what} в сервисе tela.`
    : `Вас приглашают в ${what} в сервисе tela.`
  const invEmail = (data.email ?? '').toLowerCase()
  const user = me.data
  const myEmail = (user?.email ?? '').toLowerCase()

  async function onAccept() {
    setError(null)
    try {
      await accept.mutateAsync(token)
      void navigate({ to: '/' })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось принять приглашение.')
    }
  }

  // Signed in with the invited address → one-click join.
  if (user && myEmail === invEmail) {
    return (
      <Shell title={`Присоединиться к ${target}`} description={invitedBy}>
        <div className="flex flex-col items-center gap-[var(--space-3)]">
          <Button variant="primary" size="lg" disabled={accept.isPending} onClick={onAccept}>
            {accept.isPending ? 'Присоединение…' : `Присоединиться к ${target}`}
          </Button>
          {error ? (
            <p className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]">{error}</p>
          ) : null}
        </div>
      </Shell>
    )
  }

  // Signed in as someone else.
  if (user) {
    return (
      <Shell
        title={`Приглашение для ${data.email}`}
        description={`Это приглашение адресовано ${data.email}, но вы вошли как ${user.email ?? user.username}. Войдите под ${data.email}, чтобы принять его.`}
      >
        <Button asChild variant="secondary" size="lg">
          <Link to="/login" search={{ next: `/invite/${token}` }}>
            Сменить аккаунт
          </Link>
        </Button>
      </Shell>
    )
  }

  // Logged out — sign up (auto-joins on email verify) or sign in.
  return (
    <Shell
      title={`Присоединиться к ${target} в сервисе tela`}
      description={`${invitedBy} Создайте аккаунт с адресом ${data.email} или войдите, чтобы принять приглашение.`}
    >
      <div className="flex flex-col items-stretch gap-[var(--space-2)]">
        <Button asChild variant="primary" size="lg">
          <Link to="/register" search={{ email: data.email }}>
            Создать аккаунт
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/login" search={{ next: `/invite/${token}` }}>
            У меня уже есть аккаунт
          </Link>
        </Button>
      </div>
    </Shell>
  )
}
