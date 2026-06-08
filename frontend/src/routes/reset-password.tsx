import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { ApiError } from '../lib/api'
import { useResetPassword } from '../lib/queries/auth'
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

export function ResetPasswordPage() {
  const search = useSearch({ from: '/reset-password' }) as { token?: string }
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const reset = useResetPassword()
  const token = search.token ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    try {
      await reset.mutateAsync({ token, password })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_token') {
        setError('This reset link is invalid or has expired. Request a new one.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    }
  }

  if (done) {
    return (
      <AuthShell>
        <Card className="tela-auth-card w-full bg-[var(--surface-1)] shadow-[var(--shadow-lg)] text-center">
          <CardHeader className="items-center">
            <CardTitle className="text-[length:var(--text-2xl)]">
              Password updated
            </CardTitle>
            <CardDescription>
              You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Button asChild variant="primary" size="lg">
              <Link to="/login">Sign in</Link>
            </Button>
          </CardBody>
        </Card>
      </AuthShell>
    )
  }

  if (!token) {
    return (
      <AuthShell>
        <Card className="tela-auth-card w-full bg-[var(--surface-1)] shadow-[var(--shadow-lg)] text-center">
          <CardHeader className="items-center">
            <CardTitle className="text-[length:var(--text-2xl)]">
              Link invalid
            </CardTitle>
            <CardDescription>
              This reset link is missing its token. Request a new one.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Button asChild variant="primary" size="lg">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
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
            Choose a new password
          </CardTitle>
          <CardDescription>
            Enter a new password for your account.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-[var(--space-4)]"
            noValidate
          >
            <AuthField id="reset-password" label="New password">
              <Input
                id="reset-password"
                type="password"
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error != null}
              />
            </AuthField>
            <AuthField id="reset-confirm" label="Confirm password">
              <Input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={error != null}
              />
            </AuthField>
            {error ? (
              <p
                role="alert"
                className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]"
              >
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={reset.isPending}
            >
              {reset.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </form>
          <AuthFooterLink>
            <Link
              to="/login"
              className="text-[var(--accent)] no-underline hover:underline"
            >
              Back to sign in
            </Link>
          </AuthFooterLink>
        </CardBody>
      </Card>
    </AuthShell>
  )
}
