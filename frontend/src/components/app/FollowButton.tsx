import { Bell } from 'lucide-react'
import {
  useSubscription,
  useToggleSubscription,
  type SubscribableKind,
} from '../../lib/queries/subscriptions'
import { Button } from '../ui/button'

// Header follow toggle for a page or space — opts into change notifications.
// For a space, following also surfaces NEW pages added to it. Icon-only (like
// the favorite star) to keep the header compact; filled when following.
export function FollowButton({ id, kind = 'page' }: { id: number; kind?: SubscribableKind }) {
  const { data } = useSubscription(kind, id)
  const toggle = useToggleSubscription(kind, id)
  const following = data ?? false
  const noun = kind === 'space' ? 'space' : 'page'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => toggle.mutate(following)}
      disabled={toggle.isPending}
      aria-label={following ? `Following this ${noun} — unfollow` : `Follow this ${noun}`}
      title={
        following
          ? 'Following — you’ll be notified of changes'
          : kind === 'space'
            ? 'Follow to be notified of new and changed pages'
            : 'Follow to be notified when this page changes'
      }
      className="h-[var(--space-8)] w-[var(--space-8)] p-0"
    >
      <Bell
        width={16}
        height={16}
        className={following ? 'fill-[var(--accent)] text-[var(--accent)]' : undefined}
      />
    </Button>
  )
}
