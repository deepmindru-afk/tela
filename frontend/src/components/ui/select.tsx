import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { selectVariants } from './select-variants'

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, size, children, ...props },
  ref,
) {
  return (
    <span className="relative inline-block w-full">
      <select
        ref={ref}
        className={cn(selectVariants({ size }), className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        width={16}
        height={16}
        className="pointer-events-none absolute right-[var(--space-3)] top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      />
    </span>
  )
})
