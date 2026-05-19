import { cva } from 'class-variance-authority'

// Native <select> wrapped to share Input's surface/border/focus tokens. The
// dropdown popup itself is browser-rendered (not stylable cross-browser); the
// closed-state trigger is fully tokenized.
export const selectVariants = cva(
  [
    'block w-full appearance-none',
    'font-[family-name:var(--font-sans)]',
    'leading-[var(--leading-tight)]',
    'rounded-[var(--radius-md)]',
    'bg-[var(--surface-1)] text-[var(--text-primary)]',
    'border border-[var(--border-subtle)]',
    'transition-[background-color,color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
    'outline-none cursor-pointer',
    'focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-1)]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--surface-2)]',
    'aria-invalid:border-[var(--danger)] aria-invalid:focus-visible:ring-[var(--danger)]',
  ],
  {
    variants: {
      size: {
        sm: 'text-[length:var(--text-xs)] pl-[var(--space-3)] pr-[var(--space-7)] py-[var(--space-1)] h-[calc(var(--space-7)-var(--space-1))]',
        md: 'text-[length:var(--text-sm)] pl-[var(--space-3)] pr-[var(--space-7)] py-[var(--space-2)] h-[var(--space-8)]',
        lg: 'text-[length:var(--text-base)] pl-[var(--space-4)] pr-[var(--space-8)] py-[var(--space-3)] h-[calc(var(--space-8)+var(--space-2))]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)
