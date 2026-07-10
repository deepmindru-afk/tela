import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useRequestPasswordReset } from '../lib/queries/auth'
import { Button } from '../components/ui/button'
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Input } from '../components/ui/input'
import { AuthShell, AuthField, AuthFooterLink } from '../components/app/AuthShell'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const request = useRequestPasswordReset()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    // Always-202 endpoint: any outcome lands on the same neutral message so we
    // never reveal whether the address is registered.
    try {
      await request.mutateAsync(email.trim())
    } catch {
      /* ignore */
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell>
        <Card className="tela-auth-card w-full bg-[var(--surface-1)] shadow-[var(--shadow-lg)]">
          <CardHeader>
            <CardTitle className="text-[length:var(--text-2xl)]">
              Проверьте почту
            </CardTitle>
            <CardDescription>
              Если аккаунт существует для этого адреса, мы отправили ссылку для сброса
              пароля.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <AuthFooterLink>
              <Link
                to="/login"
                className="text-[var(--accent)] no-underline hover:underline"
              >
                Назад к входу
              </Link>
            </AuthFooterLink>
          </CardBody>
        </Card>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Card className="tela-auth-card w-full bg-[var(--surface-1)] shadow-[var(--shadow-lg)]">
        <CardHeader>
          <CardTitle className="text-[length:var(--text-2xl)]">
            Сбросить пароль
          </CardTitle>
          <CardDescription>
            Введите email аккаунта, и мы отправим ссылку для сброса.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-[var(--space-4)]"
            noValidate
          >
            <AuthField id="forgot-email" label="Email">
              <Input
                id="forgot-email"
                type="email"
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </AuthField>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={request.isPending}
            >
              {request.isPending ? 'Отправка…' : 'Отправить ссылку'}
            </Button>
          </form>
          <AuthFooterLink>
            Вспомнили?{' '}
            <Link
              to="/login"
              className="text-[var(--accent)] no-underline hover:underline"
            >
              Войти
            </Link>
          </AuthFooterLink>
        </CardBody>
      </Card>
    </AuthShell>
  )
}
