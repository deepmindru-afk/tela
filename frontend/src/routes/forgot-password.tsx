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
        <Card className="w-full max-w-[24rem]">
          <CardHeader>
            <CardTitle className="text-[length:var(--text-2xl)]">
              Check your email
            </CardTitle>
            <CardDescription>
              If an account exists for that address, we've sent a link to reset
              your password.
            </CardDescription>
          </CardHeader>
          <CardBody>
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

  return (
    <AuthShell>
      <Card className="w-full max-w-[24rem]">
        <CardHeader>
          <CardTitle className="text-[length:var(--text-2xl)]">
            Reset your password
          </CardTitle>
          <CardDescription>
            Enter your account email and we'll send a reset link.
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
              {request.isPending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
          <AuthFooterLink>
            Remembered it?{' '}
            <Link
              to="/login"
              className="text-[var(--accent)] no-underline hover:underline"
            >
              Sign in
            </Link>
          </AuthFooterLink>
        </CardBody>
      </Card>
    </AuthShell>
  )
}
