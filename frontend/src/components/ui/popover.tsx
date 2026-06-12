import { forwardRef } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/utils'

// Owned Popover primitive (Radix) — a click-triggered floating panel for richer
// content than a tooltip (links, prose, small lists) that a DropdownMenu would
// model wrongly (it's not a menu of actions). Styling lives in the `tela-popover-*`
// component-layer classes, mirroring the dropdown's tokens-only approach.

// eslint-disable-next-line react-refresh/only-export-components
export const Popover = PopoverPrimitive.Root
// eslint-disable-next-line react-refresh/only-export-components
export const PopoverTrigger = PopoverPrimitive.Trigger
// eslint-disable-next-line react-refresh/only-export-components
export const PopoverAnchor = PopoverPrimitive.Anchor

export const PopoverContent = forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent(
  { className, sideOffset = 6, align = 'start', ...props },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn('tela-popover-content', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
})
