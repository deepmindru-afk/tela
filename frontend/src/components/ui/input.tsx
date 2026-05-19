import { forwardRef } from 'react'
import { type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { inputVariants } from './input-variants'

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
