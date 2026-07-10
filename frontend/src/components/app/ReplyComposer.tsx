import { useState } from 'react'
import { ApiError } from '../../lib/api'
import { Button } from '../ui/button'
import { TextArea } from '../ui/textarea'

interface ReplyComposerProps {
  // Anchor is inherited from the root — no capture in the reply path.
  onSubmit: (body: string) => Promise<void>
  onCancel: () => void
  autoFocus?: boolean
}

export function ReplyComposer({ onSubmit, onCancel, autoFocus }: ReplyComposerProps) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed) {
      setError('Body is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setBody('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to post reply.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)] mt-[var(--space-2)]">
      <TextArea
        font="sans"
        size="sm"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        disabled={busy}
        autoFocus={autoFocus}
        aria-label="Текст ответа"
      />
      {error ? (
        <p
          role="alert"
          className="m-0 text-[length:var(--text-xs)] text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-[var(--space-2)]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >Отмена</Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={busy || body.trim().length === 0}
        >
          {busy ? 'Posting…' : 'Reply'}
        </Button>
      </div>
    </div>
  )
}
