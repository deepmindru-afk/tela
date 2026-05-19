import { forwardRef } from 'react'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { toggleVariants } from './toggle-variants'

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {}

export const Toggle = forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  ToggleProps
>(function Toggle({ className, size, ...props }, ref) {
  return (
    <TogglePrimitive.Root
      ref={ref}
      className={cn(toggleVariants({ size }), className)}
      {...props}
    />
  )
})

export const ToggleGroup = forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(function ToggleGroup({ className, ...props }, ref) {
  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn(
        'inline-flex items-center gap-[var(--space-1)]',
        'p-[var(--space-1)]',
        'bg-[var(--surface-2)] border border-[var(--border-subtle)]',
        'rounded-[var(--radius-md)]',
        className,
      )}
      {...props}
    />
  )
})

export interface ToggleGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>,
    VariantProps<typeof toggleVariants> {}

export const ToggleGroupItem = forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  ToggleGroupItemProps
>(function ToggleGroupItem({ className, size, ...props }, ref) {
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(toggleVariants({ size }), className)}
      {...props}
    />
  )
})
