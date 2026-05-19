import { cva } from 'class-variance-authority'

export const toggleVariants = cva(
  [
    'inline-flex items-center justify-center gap-[var(--space-2)]',
    'font-[family-name:var(--font-sans)]',
    'leading-[var(--leading-tight)]',
    'rounded-[var(--radius-sm)]',
    'border border-transparent bg-transparent',
    'text-[var(--text-primary)]',
    'cursor-pointer select-none whitespace-nowrap',
    'transition-[background-color,color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
    'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
    'hover:bg-[var(--surface-3)]',
    'data-[state=on]:bg-[var(--accent)] data-[state=on]:text-[var(--accent-fg)]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
  ],
  {
    variants: {
      size: {
        sm: 'text-[length:var(--text-xs)] px-[var(--space-2)] py-[var(--space-1)] h-[calc(var(--space-7)-var(--space-1))]',
        md: 'text-[length:var(--text-sm)] px-[var(--space-3)] py-[var(--space-2)] h-[var(--space-7)]',
        lg: 'text-[length:var(--text-base)] px-[var(--space-4)] py-[var(--space-3)] h-[var(--space-8)]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)
