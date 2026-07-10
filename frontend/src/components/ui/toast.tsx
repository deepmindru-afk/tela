import { useEffect, useSyncExternalStore } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '../../lib/utils'

// Owned, dependency-free toast layer. A tiny module-level store + a <Toaster/>
// viewport (mounted once at the app root). Call `toast({ title, description,
// variant })` from anywhere — including non-React code like the editor's upload
// plugin — to surface a transient notification. Styling is `tela-toast*` classes
// in index.css (tokens only); accessibility via aria-live so screen readers
// announce it. This is the app's first toast surface (PageView previously noted
// "v0 has no toast layer").

export type ToastVariant = 'default' | 'success' | 'destructive'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
  /** ms before auto-dismiss; 0 keeps it until dismissed. Default 5000. */
  duration?: number
  /** Show a spinner + accent border for an in-flight task (pair with duration 0). */
  loading?: boolean
}

interface ToastItem
  extends Required<Omit<ToastOptions, 'title' | 'description'>> {
  id: number
  title?: string
  description?: string
}

let counter = 0
let items: ToastItem[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot() {
  return items
}

// eslint-disable-next-line react-refresh/only-export-components
export function toast(opts: ToastOptions): number {
  const id = ++counter
  items = [
    ...items,
    { id, variant: 'default', duration: 5000, loading: false, ...opts },
  ]
  emit()
  return id
}

// eslint-disable-next-line react-refresh/only-export-components
export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

// Mutate an existing toast in place (e.g. flip a loading toast to a success
// result) so a task's start and end read as one notification, not two.
// eslint-disable-next-line react-refresh/only-export-components
export function updateToast(id: number, opts: ToastOptions) {
  items = items.map((t) => (t.id === id ? { ...t, ...opts } : t))
  emit()
}

function ToastCard({ item }: { item: ToastItem }) {
  useEffect(() => {
    if (item.duration <= 0) return
    const h = setTimeout(() => dismissToast(item.id), item.duration)
    return () => clearTimeout(h)
  }, [item.id, item.duration])

  return (
    <div
      className={cn(
        'tela-toast',
        `tela-toast-${item.variant}`,
        item.loading && 'tela-toast-loading',
      )}
      role={item.variant === 'destructive' ? 'alert' : 'status'}
      aria-live={item.variant === 'destructive' ? 'assertive' : 'polite'}
    >
      {item.loading && (
        <Loader2 className="tela-toast-spinner" aria-hidden="true" />
      )}
      <div className="tela-toast-body">
        {item.title && <div className="tela-toast-title">{item.title}</div>}
        {item.description && <div className="tela-toast-description">{item.description}</div>}
      </div>
      <button
        type="button"
        className="tela-toast-close"
        aria-label="Закрыть уведомление"
        onClick={() => dismissToast(item.id)}
      >
        <X className="tela-toast-close-icon" />
      </button>
    </div>
  )
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, getSnapshot)
  if (list.length === 0) return null
  return (
    <div className="tela-toast-viewport" aria-label="Уведомления">
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}
