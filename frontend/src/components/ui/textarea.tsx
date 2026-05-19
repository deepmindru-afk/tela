import { forwardRef } from 'react'
import { type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { textareaVariants } from './textarea-variants'

export interface TextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    VariantProps<typeof textareaVariants> {}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ className, font, size, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(textareaVariants({ font, size }), className)}
        {...props}
      />
    )
  },
)
