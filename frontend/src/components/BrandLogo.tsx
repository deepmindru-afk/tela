import { BrandMark } from './BrandMark'
import { useHostContext } from '../lib/queries/host-context'
import { cn } from '../lib/utils'

// BrandLogo — the single brand affordance used across the app chrome (auth
// header, sidebar, app header). It white-labels off host-context:
//   - org with a logo_url  → the org's logo <img> (alt = org name)
//   - org without a logo   → the org name as a wordmark
//   - no org (canonical)   → the tela BrandMark tile + "tela" wordmark
// It reproduces the markup/sizing each spot used before (a `size`-px mark + a
// text wordmark), so callers just drop it in. `size` is the mark's px edge
// (a numeric SVG/height prop — the legit non-token exception BrandMark already
// uses); the logo <img> is height-bounded to match and width:auto.
export function BrandLogo({
  size = 22,
  className,
}: {
  size?: number
  className?: string
}) {
  const org = useHostContext().data?.org ?? null

  const wordmark = cn(
    'inline-flex items-center gap-[var(--space-2)]',
    'font-[family-name:var(--font-sans)] text-[var(--text-primary)]',
    className,
  )

  if (org) {
    if (org.logo_url) {
      return (
        <span className={wordmark}>
          <img
            src={org.logo_url}
            alt={org.name}
            style={{ height: size, width: 'auto' }}
            className="block max-h-[var(--space-7)] object-contain"
          />
        </span>
      )
    }
    return <span className={wordmark}>{org.name}</span>
  }

  return (
    <span className={wordmark}>
      <BrandMark size={size} />
      tela
    </span>
  )
}
