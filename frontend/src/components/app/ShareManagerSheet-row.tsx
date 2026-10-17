import { useEffect, useRef, useState } from 'react'
import { Copy, Link as LinkIcon, MoreHorizontal } from 'lucide-react'
import { type ShareDTO } from '../../lib/queries/share'
import { parseSqliteTs } from '../../lib/types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'
import {
  formatExpiry,
  normaliseExpiryInput,
  shareErrorMessage,
} from './ShareManagerSheet-utils'

const COPIED_FLASH_MS = 1200

export type SharePatch =
  | { include_descendants: boolean }
  | { password: string | null }
  | { expires_at: string | null }

interface ShareRowProps {
  share: ShareDTO
  onUpdate: (patch: SharePatch) => Promise<ShareDTO>
  onRevoke: () => Promise<void>
}

type InlineMode = 'idle' | 'edit-password' | 'edit-expiry' | 'confirm-revoke'

export function ShareRow({ share, onUpdate, onRevoke }: ShareRowProps) {
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<InlineMode>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // Tick once per minute so the expiry countdown stays roughly fresh while the
  // sheet is open; cheap and never visible enough to need finer cadence.
  useEffect(() => {
    if (!share.expires_at) return
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [share.expires_at])

  const copyTimerRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (copyTimerRef.current != null)
        window.clearTimeout(copyTimerRef.current)
    },
    [],
  )

  async function handleCopy() {
    setError(null)
    try {
      // Some browsers (older Safari, Firefox on insecure origin) ship without
      // navigator.clipboard. Fall back to a plain message so dev-mode
      // (localhost over HTTP) doesn't crash.
      if (!navigator.clipboard?.writeText) {
        throw new Error('Буфер обмена недоступен — скопируйте ссылку вручную.')
      }
      await navigator.clipboard.writeText(share.url)
      setCopied(true)
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null
        setCopied(false)
      }, COPIED_FLASH_MS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скопировать.')
    }
  }

  async function runUpdate(patch: SharePatch): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await onUpdate(patch)
      return true
    } catch (err) {
      setError(shareErrorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleDescendants() {
    await runUpdate({ include_descendants: !share.include_descendants })
  }

  async function handleRevokeConfirmed() {
    setBusy(true)
    setError(null)
    try {
      await onRevoke()
      // Row will disappear once the list refetch lands; no further state to clean.
    } catch (err) {
      setError(shareErrorMessage(err))
      setBusy(false)
      setMode('idle')
    }
  }

  const expiryLabel = formatExpiry(share.expires_at, now)
  const expired =
    !!share.expires_at && parseSqliteTs(share.expires_at).getTime() <= now

  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--space-2)]',
        'rounded-[var(--radius-md)] border border-[var(--border-subtle)]',
        'bg-[var(--surface-1)]',
        'px-[var(--space-3)] py-[var(--space-3)]',
      )}
    >
      <div className="flex items-start gap-[var(--space-2)]">
        <LinkIcon
          aria-hidden
          width={14}
          height={14}
          className="mt-[2px] shrink-0 text-[var(--text-muted)]"
        />
        <span
          className="flex-1 min-w-0 truncate text-[length:var(--text-sm)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]"
          title={share.url}
        >
          {share.url}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleCopy()}
          className="h-[var(--space-7)] px-[var(--space-2)] shrink-0"
          aria-label={copied ? 'Скопировано' : 'Копировать ссылку'}
        >
          <Copy width={12} height={12} />
          <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Действия со ссылкой"
              className="h-[var(--space-7)] w-[var(--space-7)] p-0 shrink-0"
              disabled={busy}
            >
              <MoreHorizontal width={14} height={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setError(null)
                setMode('edit-password')
              }}
            >
              {share.has_password ? 'Изменить пароль' : 'Установить пароль'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setError(null)
                setMode('edit-expiry')
              }}
            >
              {share.expires_at ? 'Изменить срок действия' : 'Установить срок действия'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleToggleDescendants()}>
              {share.include_descendants
                ? 'Только эта страница'
                : 'Включить дочерние страницы'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={() => {
                setError(null)
                setMode('confirm-revoke')
              }}
            >
              Отозвать
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {(share.include_descendants ||
        share.has_password ||
        expiryLabel != null) && (
        <div className="flex flex-wrap items-center gap-[var(--space-1)] pl-[calc(14px+var(--space-2))]">
          {share.include_descendants ? (
            <Badge variant="muted">Включает дочерние страницы</Badge>
          ) : null}
          {share.has_password ? <Badge variant="muted">Пароль</Badge> : null}
          {expiryLabel ? (
            <Badge variant={expired ? 'accent' : 'muted'}>{expiryLabel}</Badge>
          ) : null}
        </div>
      )}

      {mode === 'edit-password' ? (
        <PasswordInlineForm
          hasPassword={share.has_password}
          busy={busy}
          onSave={async (next) => {
            const ok = await runUpdate({ password: next })
            if (ok) setMode('idle')
          }}
          onClear={async () => {
            const ok = await runUpdate({ password: null })
            if (ok) setMode('idle')
          }}
          onCancel={() => setMode('idle')}
        />
      ) : null}

      {mode === 'edit-expiry' ? (
        <ExpiryInlineForm
          currentExpiresAt={share.expires_at}
          busy={busy}
          onSave={async (next) => {
            const ok = await runUpdate({ expires_at: next })
            if (ok) setMode('idle')
          }}
          onClear={async () => {
            const ok = await runUpdate({ expires_at: null })
            if (ok) setMode('idle')
          }}
          onCancel={() => setMode('idle')}
        />
      ) : null}

      {mode === 'confirm-revoke' ? (
        <div
          className={cn(
            'flex items-center justify-between gap-[var(--space-2)]',
            'rounded-[var(--radius-sm)] bg-[var(--surface-2)]',
            'px-[var(--space-2)] py-[var(--space-2)]',
          )}
        >
          <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
            Отозвать ссылку? Те, у кого есть эта ссылка, увидят «Недоступно».
          </span>
          <div className="flex items-center gap-[var(--space-1)] shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode('idle')}
              disabled={busy}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => void handleRevokeConfirmed()}
              disabled={busy}
            >
              {busy ? 'Отзыв…' : 'Отозвать'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface PasswordInlineFormProps {
  hasPassword: boolean
  busy: boolean
  onSave: (next: string) => Promise<void>
  onClear: () => Promise<void>
  onCancel: () => void
}

function PasswordInlineForm({
  hasPassword,
  busy,
  onSave,
  onClear,
  onCancel,
}: PasswordInlineFormProps) {
  const [value, setValue] = useState('')
  const trimmed = value.trim()
  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--space-2)]',
        'rounded-[var(--radius-sm)] bg-[var(--surface-2)]',
        'px-[var(--space-2)] py-[var(--space-2)]',
      )}
    >
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
          {hasPassword ? 'Новый пароль' : 'Пароль'}
        </span>
        <Input
          size="sm"
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasPassword ? 'Введите новый пароль' : 'Установите пароль'}
          aria-label="Пароль ссылки"
          disabled={busy}
        />
      </label>
      <div className="flex items-center justify-end gap-[var(--space-2)]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          Отмена
        </Button>
        {hasPassword ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void onClear()}
            disabled={busy}
          >
            Очистить пароль
          </Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void onSave(trimmed)}
          disabled={busy || trimmed.length === 0}
        >
          {busy ? 'Сохранение…' : 'Установить пароль'}
        </Button>
      </div>
    </div>
  )
}

interface ExpiryInlineFormProps {
  currentExpiresAt: string | null
  busy: boolean
  onSave: (next: string) => Promise<void>
  onClear: () => Promise<void>
  onCancel: () => void
}

function ExpiryInlineForm({
  currentExpiresAt,
  busy,
  onSave,
  onClear,
  onCancel,
}: ExpiryInlineFormProps) {
  const [value, setValue] = useState<string>(currentExpiresAt ?? '')
  const wire = normaliseExpiryInput(value)
  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--space-2)]',
        'rounded-[var(--radius-sm)] bg-[var(--surface-2)]',
        'px-[var(--space-2)] py-[var(--space-2)]',
      )}
    >
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
          Действует до (UTC)
        </span>
        <Input
          size="sm"
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="YYYY-MM-DD HH:MM:SS"
          aria-label="Срок действия ссылки"
          disabled={busy}
        />
      </label>
      <div className="flex items-center justify-end gap-[var(--space-2)]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          Отмена
        </Button>
        {currentExpiresAt ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void onClear()}
            disabled={busy}
          >
            Очистить срок действия
          </Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void onSave(wire)}
          disabled={busy || wire.length === 0}
        >
          {busy ? 'Сохранение…' : 'Установить срок действия'}
        </Button>
      </div>
    </div>
  )
}
