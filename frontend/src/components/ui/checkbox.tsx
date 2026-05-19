import { forwardRef } from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        'h-[var(--space-4)] w-[var(--space-4)]',
        'rounded-[var(--radius-sm)]',
        'border border-[var(--border)] bg-[var(--surface-1)]',
        'cursor-pointer',
        'transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)]',
        'data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:text-[var(--accent-fg)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check width={12} height={12} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
