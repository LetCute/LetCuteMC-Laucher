import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
  description?: string
  icon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, description, icon, ...props }, ref) => {
    const id = React.useId()
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {icon}
            </div>
          )}
          <InputPrimitive
            ref={ref}
            id={id}
            type={type}
            data-slot="input"
            className={cn(
              "h-10 w-full min-w-0 rounded-xl border bg-input px-3 py-2 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground",
              "focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30",
              "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/25"
                : "border-border",
              icon ? "pl-10" : "pl-3",
              className
            )}
            {...props}
          />
        </div>
        {description && !error && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }
