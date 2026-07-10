import { useEffect, useRef, useState } from 'react'
import { Check, FolderPlus } from 'lucide-react'
import { Input } from '../../ui/input'

export interface SpaceChoice {
  space_id?: number
  new_space_name?: string
}

// One combined control: type to filter the spaces you can write to and pick one,
// or type a name that matches nothing to create a new space on the next run.
// No "existing vs new" mode toggle — the text you leave decides.
export function SpacePicker({
  spaces,
  value,
  onChange,
  placeholder = 'Search a space, or name a new one…',
}: {
  spaces: { id: number; name: string }[]
  value: SpaceChoice
  onChange: (v: SpaceChoice) => void
  placeholder?: string
}) {
  const selectedName =
    value.space_id != null ? spaces.find((s) => s.id === value.space_id)?.name ?? '' : value.new_space_name ?? ''
  const [query, setQuery] = useState(selectedName)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Reflect external value changes (e.g. resetting a form) into the field.
  useEffect(() => {
    setQuery(selectedName)
  }, [selectedName])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const q = query.trim().toLowerCase()
  const matches = spaces.filter((s) => s.name.toLowerCase().includes(q))
  const exact = spaces.some((s) => s.name.toLowerCase() === q)

  function pick(s: { id: number; name: string }) {
    setQuery(s.name)
    setOpen(false)
    onChange({ space_id: s.id })
  }
  function type(v: string) {
    setQuery(v)
    setOpen(true)
    onChange(v.trim() ? { new_space_name: v.trim() } : {})
  }

  return (
    <div ref={ref} className="relative">
      <Input value={query} onChange={(e) => type(e.target.value)} onFocus={() => setOpen(true)} placeholder={placeholder} />
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-[var(--space-1)] max-h-[14rem] overflow-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] py-[var(--space-1)] shadow-[var(--shadow-md)]">
          {matches.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] text-left text-[length:var(--text-sm)] text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
            >
              <Check className={['size-[var(--space-4)] shrink-0', value.space_id === s.id ? 'opacity-100 text-[var(--accent)]' : 'opacity-0'].join(' ')} />
              <span className="truncate">{s.name}</span>
            </button>
          ))}
          {q && !exact && (
            <div className="flex items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--accent)]">
              <FolderPlus className="size-[var(--space-4)] shrink-0" />
              <span className="truncate">Создать новое пространство “{query.trim()}”</span>
            </div>
          )}
          {matches.length === 0 && !q && (
            <div className="px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--text-muted)]">No spaces yet — type a name to create one.</div>
          )}
        </div>
      )}
    </div>
  )
}
