import { useEffect, useRef, useState } from 'react'
import { ShareError, useShareAuth } from '../../lib/queries/share'
import { ThemeSwitcher } from '../ThemeSwitcher'
import { Button } from '../ui/button'
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Input } from '../ui/input'

interface SharePasswordScreenProps {
  token: string
}

export function SharePasswordScreen({ token }: SharePasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Rate-limit countdown. When > 0, the submit button is disabled and the
  // status copy reflects the remaining seconds. Driven by the 429 response's
  // Retry-After header on the failing auth attempt.
  const [retryAfter, setRetryAfter] = useState(0)
  const auth = useShareAuth(token)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus on mount so a user landing on the share URL with the password
  // screen can start typing immediately without reaching for the mouse.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (retryAfter <= 0) return
    const t = window.setInterval(() => {
      setRetryAfter((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => window.clearInterval(t)
  }, [retryAfter])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (retryAfter > 0) return
    setError(null)
    try {
      await auth.mutateAsync(password)
      // Success — the mutation invalidates useShareRoot, which refetches with
      // the freshly minted cookie and the parent will swap in the ShareReader.
    } catch (err) {
      if (err instanceof ShareError) {
        if (err.kind === 'rate_limited') {
          setRetryAfter(err.retryAfter ?? 60)
          setError('Слишком много попыток. Повторите чуть позже.')
          return
        }
        if (err.kind === 'invalid_password') {
          setError('Неверный пароль.')
          return
        }
        if (err.kind === 'not_found') {
          setError('Эта ссылка больше недоступна.')
          return
        }
        if (err.kind === 'bad_request') {
          setError('Для этой ссылки больше не требуется пароль.')
          return
        }
        setError(err.message || 'Что-то пошло не так.')
        return
      }
      setError('Что-то пошло не так. Попробуйте ещё раз.')
    }
  }

  const submitDisabled =
    auth.isPending || retryAfter > 0 || password.length === 0

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--surface-1)] text-[var(--text-primary)]">
      <header className="flex items-center justify-between px-[var(--space-6)] py-[var(--space-3)] border-b border-[var(--border-subtle)] shrink-0">
        <h1 className="m-0 text-[length:var(--text-lg)] leading-[var(--leading-tight)] font-[family-name:var(--font-sans)]">
          tela
        </h1>
        <ThemeSwitcher />
      </header>
      <main className="flex-1 flex items-center justify-center p-[var(--space-7)]">
        <Card className="w-full max-w-[24rem]">
          <CardHeader>
            <CardTitle className="text-[length:var(--text-2xl)]">
              Требуется пароль
            </CardTitle>
            <CardDescription>
              Эта ссылка защищена. Введите пароль, чтобы открыть её.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-[var(--space-4)]"
              noValidate
            >
              <div className="flex flex-col gap-[var(--space-2)]">
                <label
                  htmlFor="share-password"
                  className="text-[length:var(--text-sm)] text-[var(--text-muted)]"
                >
                  Пароль
                </label>
                <Input
                  id="share-password"
                  ref={inputRef}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error != null}
                  disabled={retryAfter > 0}
                />
              </div>
              {error ? (
                <p
                  role="alert"
                  className="m-0 text-[length:var(--text-sm)] text-[var(--danger)]"
                >
                  {error}
                  {retryAfter > 0 ? ` (${retryAfter} с)` : ''}
                </p>
              ) : null}
              {auth.isPending ? (
                <p
                  role="status"
                  className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]"
                >
                  Проверка…
                </p>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitDisabled}
              >
                {retryAfter > 0
                  ? `Повторите через ${retryAfter} с`
                  : auth.isPending
                    ? 'Проверка…'
                    : 'Открыть'}
              </Button>
            </form>
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
