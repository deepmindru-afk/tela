import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export const Card = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-[var(--surface-2)] text-[var(--text-primary)]',
        'border border-[var(--border-subtle)]',
        'rounded-[var(--radius-lg)]',
        'flex flex-col',
        className,
      )}
      {...props}
    />
  )
})

export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-[var(--space-1)]',
        'px-[var(--space-6)] pt-[var(--space-6)] pb-[var(--space-3)]',
        className,
      )}
      {...props}
    />
  )
})

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn(
        'm-0 font-[family-name:var(--font-sans)]',
        'text-[length:var(--text-lg)] leading-[var(--leading-tight)]',
        'text-[var(--text-primary)]',
        className,
      )}
      {...props}
    />
  )
})

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn(
        'm-0 font-[family-name:var(--font-sans)]',
        'text-[length:var(--text-sm)] leading-[var(--leading-relaxed)]',
        'text-[var(--text-muted)]',
        className,
      )}
      {...props}
    />
  )
})

export const CardBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardBody({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-[var(--space-3)]',
        'px-[var(--space-6)] py-[var(--space-3)]',
        'text-[length:var(--text-sm)] leading-[var(--leading-relaxed)]',
        className,
      )}
      {...props}
    />
  )
})

export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-[var(--space-3)]',
        'px-[var(--space-6)] pb-[var(--space-6)] pt-[var(--space-3)]',
        className,
      )}
      {...props}
    />
  )
})
