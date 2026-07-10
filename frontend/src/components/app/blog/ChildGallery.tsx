import { PostCard, type BlogPost } from './PostCard'

// The card grid of a page's direct children, shown at the foot of the public
// reader. Any page with children is a "section" — a Slides hub, a multi-part
// article, a doc folder — and presents its contents as real cards (covers, deck
// play-badges, excerpts) instead of a hand-written link list that drifts out of
// date. Children render in author order (position), matching the space-nav rail,
// not newest-first like the index posts. Reuses the index's PostCard.
export function ChildGallery({
  spaceId,
  posts,
}: {
  spaceId: number
  posts: BlogPost[]
}) {
  if (posts.length === 0) return null
  return (
    <section className="reader-childgallery" aria-label="В этом разделе">
      <h2 className="reader-childgallery-title">В этом разделе</h2>
      <div className="reader-childgallery-grid">
        {posts.map((p) => (
          <PostCard key={p.id} spaceId={spaceId} post={p} headingLevel={3} />
        ))}
      </div>
    </section>
  )
}
