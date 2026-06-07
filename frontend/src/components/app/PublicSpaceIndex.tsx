import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  type PublicPageNode,
  type PublicSpacePayload,
} from '../../lib/queries/public'
import { PublicTopbar } from './blog/PublicTopbar'
import { PublicMasthead, MetaDot } from './blog/PublicMasthead'
import { PostCard } from './blog/PostCard'

interface PublicSpaceIndexProps {
  space: PublicSpacePayload
  pages: PublicPageNode[]
}

// The curated front page of a public space — a blog-style index. Top-level pages
// are the "posts" (nested pages are sub-sections, reached by navigating in),
// newest first. The newest gets a featured lead card; the rest fall into a grid.
// Chrome mirrors the reader/author surfaces so it all reads as one site.
export function PublicSpaceIndex({ space, pages }: PublicSpaceIndexProps) {
  const posts = useMemo(
    () =>
      pages
        .filter((p) => p.parent_id == null)
        // Newest first — string UTC timestamps sort lexicographically.
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [pages],
  )

  const [featured, ...rest] = posts

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-1)] text-[var(--text-primary)]">
      <PublicTopbar />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[60rem] px-[var(--space-6)] py-[var(--space-8)]">
          <PublicMasthead
            title={space.name}
            avatarSeed={space.slug || space.name}
            standfirst={space.description || undefined}
            meta={
              <>
                {space.owner_handle ? (
                  <>
                    <span>
                      by{' '}
                      <Link
                        to="/u/$username"
                        params={{ username: space.owner_handle }}
                        className="font-medium text-[var(--text-primary)] no-underline hover:text-[var(--accent)]"
                      >
                        @{space.owner_handle}
                      </Link>
                    </span>
                    <MetaDot />
                  </>
                ) : null}
                <span>
                  {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                </span>
              </>
            }
          />

          {posts.length === 0 ? (
            <p className="mt-[var(--space-8)] text-[length:var(--text-sm)] text-[var(--text-muted)]">
              Nothing published here yet.
            </p>
          ) : (
            <div className="mt-[var(--space-8)] flex flex-col gap-[var(--space-5)]">
              {featured ? (
                <PostCard spaceId={space.id} post={featured} featured />
              ) : null}
              {rest.length > 0 ? (
                <div className="grid grid-cols-1 gap-[var(--space-5)] sm:grid-cols-2">
                  {rest.map((p) => (
                    <PostCard key={p.id} spaceId={space.id} post={p} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
