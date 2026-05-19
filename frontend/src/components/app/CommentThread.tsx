import { useState } from 'react'
import { CornerDownRight, MessageSquare } from 'lucide-react'
import type { CommentThread as CommentThreadType } from '../../lib/comments/use-comments'
import { ApiError } from '../../lib/api'
import { Button } from '../ui/button'
import { CommentItem } from './CommentItem'
import { ReplyComposer } from './ReplyComposer'
import { cn } from '../../lib/utils'

interface CommentThreadProps {
  thread: CommentThreadType
  currentUserId: number
  isSpaceOwner: boolean
  onEditComment: (id: number, body: string) => Promise<void>
  onDeleteComment: (id: number) => Promise<void>
  onReply: (parentId: number, body: string) => Promise<void>
}

function isOptimistic(id: number): boolean {
  return id < 0
}

export function CommentThread({
  thread,
  currentUserId,
  isSpaceOwner,
  onEditComment,
  onDeleteComment,
  onReply,
}: CommentThreadProps) {
  const [replying, setReplying] = useState(false)
  const { root, replies } = thread
  const rootMuted = root.resolved

  async function handleReply(body: string) {
    try {
      await onReply(root.id, body)
      setReplying(false)
    } catch (err) {
      // Surface failure into the reply composer's error path by re-throwing.
      throw err instanceof ApiError ? err : new Error('reply failed')
    }
  }

  return (
    <li
      className={cn(
        'list-none m-0 p-[var(--space-3)]',
        'rounded-[var(--radius-md)] border border-[var(--border-subtle)]',
        'bg-[var(--surface-1)]',
        'flex flex-col gap-[var(--space-1)]',
      )}
      data-comment-thread-id={String(root.id)}
    >
      {root.anchor_exact ? (
        <blockquote
          className={cn(
            'm-0 px-[var(--space-3)] py-[var(--space-2)]',
            'border-l-2 border-[var(--border-strong)]',
            'bg-[var(--surface-2)]',
            'text-[length:var(--text-xs)] text-[var(--text-muted)] font-[family-name:var(--font-sans)]',
            'whitespace-pre-wrap line-clamp-3',
          )}
        >
          {root.anchor_exact}
        </blockquote>
      ) : null}

      <CommentItem
        comment={root}
        currentUserId={currentUserId}
        isSpaceOwner={isSpaceOwner}
        onEdit={onEditComment}
        onDelete={onDeleteComment}
        isOptimistic={isOptimistic(root.id)}
        muted={rootMuted}
      />

      {replies.length > 0 ? (
        <ul className="m-0 p-0 flex flex-col gap-[var(--space-1)] pl-[var(--space-4)] border-l-2 border-[var(--border-subtle)]">
          {replies.map((r) => (
            <li key={r.id} className="list-none m-0 p-0">
              <CommentItem
                comment={r}
                currentUserId={currentUserId}
                isSpaceOwner={isSpaceOwner}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
                isOptimistic={isOptimistic(r.id)}
                muted={rootMuted}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-1)]">
        {!replying ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReplying(true)}
            disabled={isOptimistic(root.id)}
          >
            <CornerDownRight width={12} height={12} /> Reply
          </Button>
        ) : null}
        {/*
          M8.5 (#74) wires the resolve PATCH. v0 renders a disabled
          placeholder so the affordance ships now and #74 only has to
          toggle disabled + the onClick handler.
        */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          title="Resolve toggle ships in M8.5 (#74)"
        >
          <MessageSquare width={12} height={12} />{' '}
          {root.resolved ? 'Reopen' : 'Resolve'}
        </Button>
      </div>

      {replying ? (
        <ReplyComposer
          autoFocus
          onSubmit={handleReply}
          onCancel={() => setReplying(false)}
        />
      ) : null}
    </li>
  )
}
