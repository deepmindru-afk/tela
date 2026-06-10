import { ThemeSwitcher } from '../../ThemeSwitcher'
import { Button } from '../../ui/button'
import { useTelaHomeHref } from '../../../lib/queries/host-context'

// The shared chrome for the no-login public surfaces — the space front page,
// the author home, and (via the reader's own topbar) the reader. A wordmark
// home link on the left, theme switch + Sign in on the right. Extracted so the
// three surfaces read as one site and the header is defined once.
export function PublicTopbar() {
  const telaHome = useTelaHomeHref()
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--surface-1)_88%,transparent)] px-[var(--space-5)] py-[var(--space-3)] backdrop-blur-md">
      <a
        href={telaHome}
        aria-label="tela home"
        className="inline-block rounded-[var(--radius-xs)] font-[family-name:var(--font-sans)] text-[length:var(--text-base)] font-semibold tracking-[-0.01em] text-[var(--text-primary)] no-underline transition-opacity duration-[var(--duration-fast)] hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        tela
      </a>
      <div className="flex items-center gap-[var(--space-2)]">
        <ThemeSwitcher />
        <Button asChild variant="ghost" size="sm">
          <a href="/login">Sign in</a>
        </Button>
      </div>
    </header>
  )
}
