import { ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  showBorder?: boolean
}

export const EmptyState = ({ icon, title, description, action, showBorder = true }: EmptyStateProps) => {
  return (
    <div className={`flex flex-1 flex-col items-center justify-center p-12 text-center rounded-md bg-muted/10 ${showBorder ? 'border-2 border-dashed border-border/50' : ''}`}>
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
