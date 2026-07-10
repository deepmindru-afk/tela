import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useVerifyEmail } from '../lib/queries/auth'
import { Button } from '../components/ui/button'
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { AuthShell } from '../components/app/AuthShell'

type Phase = 'verifying' | 'done' | 'error' | 'missing'

export function VerifyEmailPage() {
  const search = useSearch({ from: '/verify-email' }) as { token?: string }
  const verify = useVerifyEmail()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>(
    search.token ? 'verifying' : 'missing',
  )
  // StrictMode mounts effects twice in dev; the ref guard keeps us from
  // burning the single-use token on the throwaway first mount.
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || !search.token) return
    ran.current = true
    verify
      .mutateAsync(search.token)
      .then(() => setPhase('done'))
      .catch(() => setPhase('error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.token])

  if (phase === 'done') {
    return (
      <AuthShell>
        <Card className="tela-auth-card w-full bg-[var(--surface-1)] shadow-[var(--shadow-lg)] text-center">
          <CardHeader className="items-center">
            <CardTitle className="text-[length:var(--text-2xl)]">
              Email подтвержден
            </CardTitle>
            <CardDescription>
              Ваш аккаунт активирован. Добро пожаловать в tela.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Button
              variant="primary"
              size="lg"
              onClick={() => void navigate({ to: '/' })}
            >
              Перейти в tela
            </Button>
          </CardBody>
        </Card>
      </AuthShell>
    )
  }

  if (phase === 'verifying') {
    return (
      <AuthShell>
        <Card className="tela-auth-card w-full bg-[var(--surface-1)] shadow-[var(--shadow-lg)] text-center">
          <CardHeader className="items-center">
            <CardTitle className="text-[length:var(--text-2xl)]">
              Подтверждение…
            </CardTitle>
            <CardDescription>Пожалуйста, подождите.</CardDescription>
          </CardHeader>
        </Card>
      </AuthShell>
    )
  }

  // error | missing
  return (
    <AuthShell>
      <Card className="tela-auth-card w-full bg-[var(--surface-1)] shadow-[var(--shadow-lg)] text-center">
        <CardHeader className="items-center">
          <CardTitle className="text-[length:var(--text-2xl)]">
            Ссылка недействительна или истекла
          </CardTitle>
          <CardDescription>
            Эта ссылка для подтверждения недействительна. Войдите, чтобы запросить новую.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Button asChild variant="primary" size="lg">
            <Link to="/login">Назад к входу</Link>
          </Button>
        </CardBody>
      </Card>
    </AuthShell>
  )
}
