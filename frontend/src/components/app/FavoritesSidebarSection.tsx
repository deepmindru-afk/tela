import { Link } from '@tanstack/react-router'
import { Star } from 'lucide-react'
import { useFavorites } from '../../lib/queries/favorites'
import { cn } from '../../lib/utils'

// Sidebar "Favorites" section — the caller's starred pages, above the spaces
// list. Renders nothing until there's at least one favorite, so the sidebar
// stays clean for new users.
export function FavoritesSidebarSection({
  activePageId,
}: {
  activePageId: number | null
}) {
  const { data } = useFavorites()
  if (!data || data.length === 0) return null

  return (
    <section
      aria-labelledby="sidebar-favorites-heading"
      className="flex flex-col gap-[var(--space-1)] px-[var(--space-3)] pt-[var(--space-4)]"
    >
      <h2
        id="sidebar-favorites-heading"
        className="m-0 px-[var(--space-2)] text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--text-muted)] font-[family-name:var(--font-sans)]"
      >Избранное</h2>
      <ul className="m-0 p-0 list-none flex flex-col gap-[1px]">
        {data.map((f) => (
          <li key={f.page_id}>
            <Link
              to="/spaces/$spaceId/pages/$pageId/{-$slug}"
              params={{ spaceId: f.space_id, pageId: f.page_id, slug: undefined }}
              title={f.title || 'Untitled'}
              className={cn(
                'flex items-center gap-[var(--space-2)] px-[var(--space-2)] py-[var(--space-1)]',
                'rounded-[var(--radius-sm)] no-underline',
                'text-[length:var(--text-sm)] text-[var(--text-primary)]',
                'hover:bg-[var(--surface-3)]',
                activePageId === f.page_id &&
                  'bg-[var(--sidebar-item-active)] font-medium',
              )}
            >
              <Star
                width={14}
                height={14}
                aria-hidden
                className="shrink-0 fill-[var(--accent)] text-[var(--accent)]"
              />
              <span className="truncate">{f.title || 'Untitled'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
