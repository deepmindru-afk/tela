import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { getKeyBindings, keysOf, type KeyBinding } from '../../lib/keys/keymap'
import { cn } from '../../lib/utils'

// Render one binding's keys as keycaps. A leader sequence (`g h`) becomes two
// caps; an alias array shows only the first form to stay scannable.
function KeyCaps({ binding }: { binding: KeyBinding }) {
  const tokens = keysOf(binding)[0].split(' ')
  return (
    <span className="inline-flex items-center gap-[var(--space-1)]">
      {tokens.map((t, i) => (
        <kbd
          key={i}
          className={cn(
            'inline-flex items-center justify-center',
            'min-w-[var(--space-6)] h-[var(--space-6)] px-[var(--space-2)]',
            'rounded-[var(--radius-xs)] border border-[var(--border-subtle)]',
            'bg-[var(--surface-2)] text-[var(--text-primary)]',
            'font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] leading-none',
          )}
        >
          {t}
        </kbd>
      ))}
    </span>
  )
}

export interface KeyCheatsheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Defaults to the live registry; injectable for stories/tests.
  bindings?: KeyBinding[]
}

// The `?` keyboard cheatsheet. Reads the keymap registry and groups bindings by
// their `group`, preserving first-seen order. Self-contained (its own Dialog),
// so it works on every surface — the authed app AND the logged-out reader,
// neither of which can rely on the command palette being mounted.
export function KeyCheatsheet({
  open,
  onOpenChange,
  bindings,
}: KeyCheatsheetProps) {
  const groups = useMemo(() => {
    const src = bindings ?? getKeyBindings()
    const order: string[] = []
    const byGroup = new Map<string, KeyBinding[]>()
    for (const b of src) {
      if (!byGroup.has(b.group)) {
        byGroup.set(b.group, [])
        order.push(b.group)
      }
      byGroup.get(b.group)!.push(b)
    }
    return order.map((g) => ({ group: g, items: byGroup.get(g)! }))
  }, [bindings])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[40rem]">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press a key from anywhere — the editor and form fields are exempt.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--space-4)] grid grid-cols-1 gap-x-[var(--space-7)] gap-y-[var(--space-5)] sm:grid-cols-2">
          {groups.map(({ group, items }) => (
            <section key={group} className="flex flex-col gap-[var(--space-2)]">
              <h3 className="m-0 text-[length:var(--text-xs)] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
                {group}
              </h3>
              <ul className="m-0 p-0 list-none flex flex-col gap-[var(--space-1)]">
                {items.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-[var(--space-3)]"
                  >
                    <span className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-[family-name:var(--font-sans)]">
                      {b.label}
                    </span>
                    <KeyCaps binding={b} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
