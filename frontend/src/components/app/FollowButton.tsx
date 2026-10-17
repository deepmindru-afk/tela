import { Bell } from 'lucide-react'
import {
  useSubscription,
  useToggleSubscription,
  type SubscribableKind,
} from '../../lib/queries/subscriptions'
import { Button } from '../ui/button'
import { DropdownMenuItem } from '../ui/dropdown-menu'
import { cn } from '../../lib/utils'

// Header follow toggle for a page or space — opts into change notifications.
// For a space, following also surfaces NEW pages added to it. Icon-only (like
// the favorite star) to keep the header compact; filled when following.
//
// `asMenuItem` renders the same toggle as a labelled dropdown row — the mobile
// header folds its icon strip into the "•••" overflow (see FavoriteStar).
export function FollowButton({
  id,
  kind = 'page',
  asMenuItem,
  className,
}: {
  id: number
  kind?: SubscribableKind
  asMenuItem?: boolean
  className?: string
}) {
  const { data } = useSubscription(kind, id)
  const toggle = useToggleSubscription(kind, id)
  const following = data ?? false
  const nounAcc = kind === 'space' ? 'пространство' : 'страницу'
  const nounGen = kind === 'space' ? 'пространства' : 'страницы'

  if (asMenuItem) {
    return (
      <DropdownMenuItem
        className={className}
        disabled={toggle.isPending}
        onSelect={() => toggle.mutate(following)}
      >
        <Bell
          width={14}
          height={14}
          className={following ? 'fill-[var(--accent)] text-[var(--accent)]' : undefined}
        />
        {following ? `Отписаться от ${nounGen}` : `Подписаться на ${nounAcc}`}
      </DropdownMenuItem>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => toggle.mutate(following)}
      disabled={toggle.isPending}
      aria-label={following ? `Вы подписаны на ${nounGen} — отписаться` : `Подписаться на ${nounAcc}`}
      title={
        following
          ? 'Вы подписаны — вы будете получать уведомления об изменениях'
          : kind === 'space'
            ? 'Подпишитесь, чтобы получать уведомления о новых и изменённых страницах'
            : 'Подпишитесь, чтобы получать уведомления об изменениях этой страницы'
      }
      className={cn('h-[var(--space-8)] w-[var(--space-8)] p-0', className)}
    >
      <Bell
        width={16}
        height={16}
        className={following ? 'fill-[var(--accent)] text-[var(--accent)]' : undefined}
      />
    </Button>
  )
}
