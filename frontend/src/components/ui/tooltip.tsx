import { forwardRef } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export const TooltipPortal = TooltipPrimitive.Portal

export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent(
  { className, sideOffset = 6, children, ...props },
  ref,
) {
  return (
    <TooltipPortal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn('tela-tooltip-content', className)}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="tela-tooltip-arrow" />
      </TooltipPrimitive.Content>
    </TooltipPortal>
  )
})
