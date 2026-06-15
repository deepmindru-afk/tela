import { useState } from 'react'
import { Plug, X } from 'lucide-react'
import { useMe } from '../../lib/queries/auth'
import { DOCS } from '../../lib/docs'
import { Button } from '../ui/button'

const DISMISS_KEY = 'tela.nudge.connect-agent.dismissed'

// A gentle one-time prompt for users who haven't connected an agent yet. Hidden
// the moment they make their first MCP request (me.mcp_connected, set by the
// verifier for both PAT and OAuth), and dismissable per-device. Shown on the home
// dashboard, not as an app-wide banner — a nudge, not a nag.
export function ConnectAgentNudge() {
  const me = useMe()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  // Wait for /me; only nudge a user who genuinely hasn't connected.
  if (!me.data || me.data.mcp_connected || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore — worst case the nudge reappears next load
    }
    setDismissed(true)
  }

  return (
    <div className="flex items-start gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-[var(--space-4)]">
      <span
        aria-hidden
        className="flex size-[var(--space-7)] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]"
      >
        <Plug width={16} height={16} />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
          Connect an agent to your wiki
        </span>
        <span className="text-[length:var(--text-sm)] text-[var(--text-muted)] leading-[var(--leading-relaxed)]">
          Use Claude, Cursor, or ChatGPT to search, read, and write your spaces —
          it takes a couple of minutes.
        </span>
        <div className="mt-[var(--space-1)]">
          <Button asChild variant="primary" size="sm">
            <a href={DOCS.mcp} target="_blank" rel="noreferrer">
              Set up MCP →
            </a>
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-[var(--radius-xs)] p-[var(--space-1)] text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <X width={15} height={15} />
      </button>
    </div>
  )
}
