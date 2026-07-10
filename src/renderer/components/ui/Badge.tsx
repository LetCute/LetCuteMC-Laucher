import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-secondary-foreground border-border",
        primary:
          "bg-primary/15 text-primary border-primary/30",
        secondary:
          "bg-secondary text-secondary-foreground border-border",
        outline:
          "border-border text-foreground bg-transparent",
        ghost:
          "text-muted-foreground bg-muted/50",
        success:
          "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
        warning:
          "bg-amber-500/12 text-amber-300 border-amber-500/25",
        warn:
          "bg-amber-500/12 text-amber-300 border-amber-500/25",
        danger:
          "bg-red-500/12 text-red-300 border-red-500/25",
        destructive:
          "bg-red-500/12 text-red-300 border-red-500/25",
        info:
          "bg-cyan-500/12 text-cyan-300 border-cyan-500/25",
        accent:
          "bg-primary/12 text-primary border-primary/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
