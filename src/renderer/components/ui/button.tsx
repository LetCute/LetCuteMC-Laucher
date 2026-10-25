import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] rounded-md text-sm transition-all duration-150 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_20%,transparent)]",
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_20%,transparent)]",
        secondary:
          "bg-card text-card-foreground border border-border hover:bg-card/80",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-card/50",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-card/50 hover:text-foreground",
        sidebar:
          "bg-transparent text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground justify-start h-auto py-2.5 px-3 rounded-md font-medium",
        danger:
          "bg-red-600 text-white hover:bg-red-500",
        destructive:
          "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-11 px-6 text-base",
        icon: "size-9 p-0",
        "icon-sm": "size-8 p-0 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
