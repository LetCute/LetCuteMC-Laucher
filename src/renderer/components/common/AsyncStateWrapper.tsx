import React from 'react'
import { Loader2, PackageOpen } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'

interface AsyncStateWrapperProps {
  loading?: boolean
  loadingMessage?: string
  isEmpty?: boolean
  emptyIcon?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  children: React.ReactNode
}

export const AsyncStateWrapper: React.FC<AsyncStateWrapperProps> = ({
  loading = false,
  loadingMessage = 'Đang tải dữ liệu...',
  isEmpty = false,
  emptyIcon = <PackageOpen size={32} />,
  emptyTitle = 'Không có dữ liệu',
  emptyDescription = 'Không tìm thấy mục nào phù hợp.',
  emptyAction,
  children,
}) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 select-none">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs">{loadingMessage}</p>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground select-none">
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    )
  }

  return <>{children}</>
}
