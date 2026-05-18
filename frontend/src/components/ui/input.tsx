import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const inputVariants = cva(
  [
    'block w-full',
    'font-[family-name:var(--font-sans)]',
    'leading-[var(--leading-tight)]',
    'rounded-[var(--radius-md)]',
    'bg-[var(--surface-1)] text-[var(--text-primary)]',
    'border border-[var(--border-subtle)]',
    'placeholder:text-[var(--text-muted)]',
    'transition-[background-color,color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
    'outline-none',
    'focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-1)]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--surface-2)]',
    'aria-invalid:border-[var(--danger)] aria-invalid:focus-visible:ring-[var(--danger)] aria-invalid:focus-visible:border-[var(--danger)]',
  ],
  {
    variants: {
      size: {
        sm: 'text-[length:var(--text-xs)] px-[var(--space-3)] py-[var(--space-1)] h-[calc(var(--space-7)-var(--space-1))]',
        md: 'text-[length:var(--text-sm)] px-[var(--space-3)] py-[var(--space-2)] h-[var(--space-8)]',
        lg: 'text-[length:var(--text-base)] px-[var(--space-4)] py-[var(--space-3)] h-[calc(var(--space-8)+var(--space-2))]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  )
})

export { inputVariants }
