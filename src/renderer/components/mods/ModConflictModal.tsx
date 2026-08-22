import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Zap,
  ShieldCheck,
  AlertCircle,
  Download,
  PowerOff,
  Trash2,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/button'
import type { ModConflictCheckResult, ModConflictItem, ResolveConflictOption } from '@/shared/types'
import { cn } from '@/lib/utils'

interface ModConflictModalProps {
  isOpen: boolean
  onClose: () => void
  conflictResult: ModConflictCheckResult | null
  isScanning: boolean
  onRescan: () => void
  onResolve: (option: ResolveConflictOption) => Promise<void>
  onResolveAllCritical: () => Promise<void>
  isResolving: boolean
}

export const ModConflictModal = ({
  isOpen,
  onClose,
  conflictResult,
  isScanning,
  onRescan,
  onResolve,
  onResolveAllCritical,
  isResolving,
}: ModConflictModalProps) => {
  const conflicts = conflictResult?.conflicts || []
  const criticalCount = conflictResult?.criticalCount || 0
  const warningCount = conflictResult?.warningCount || 0

  const getActionIcon = (action: ModConflictItem['recommendedAction']) => {
    switch (action) {
      case 'disable_mod':
        return <PowerOff size={13} className="text-amber-400" />
      case 'delete_mod':
        return <Trash2 size={13} className="text-rose-400" />
      case 'install_companion':
        return <Download size={13} className="text-cyan-400" />
      default:
        return <Zap size={13} />
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chẩn đoán Xung đột & Dự đoán Crash (Conflict & Crash Predictor)"
      description="Quét phát hiện các lỗi xung đột giữa các mod, sai Loader, thiếu Indium hoặc trùng lặp tệp"
      maxWidth="max-w-[750px]"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onRescan}
            disabled={isScanning || isResolving}
            className="gap-1.5 h-8 text-xs bg-zinc-900 border-zinc-800"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isScanning && 'animate-spin')} />
            Quét lại
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="h-8 text-xs">
              Đóng
            </Button>
            {criticalCount > 0 && (
              <Button
                variant="primary"
                size="sm"
                disabled={isResolving || isScanning}
                onClick={onResolveAllCritical}
                className="h-8 px-3.5 text-xs font-bold gap-1.5 bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    Tự động sửa tất cả ({criticalCount} lỗi nguy hiểm)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1 select-none">
        {isScanning ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs">Đang đối soát metadata, Loader và quy tắc xung đột render...</p>
          </div>
        ) : (
          <>
            {/* Status Summary Banner */}
            {criticalCount === 0 && warningCount === 0 ? (
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3.5 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-300">
                    Không phát hiện xung đột nào!
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Đã kiểm tra {conflictResult?.totalMods || 0} mod. Toàn bộ các mod đều tương thích hoàn hảo và sẵn sàng khởi chạy an toàn.
                  </p>
                </div>
              </div>
            ) : criticalCount > 0 ? (
              <div className="p-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-200">
                      Phát hiện {criticalCount} xung đột nghiêm trọng có thể làm văng game!
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Khuyến nghị xử lý các lỗi đỏ bên dưới trước khi mở game để tránh crash.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3.5 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-300">
                    Có {warningCount} cảnh báo tối ưu hóa cần lưu ý
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Game vẫn có thể chạy nhưng có thể gặp giảm hiệu năng hoặc trùng lặp engine.
                  </p>
                </div>
              </div>
            )}

            {/* Conflicts List */}
            {conflicts.length > 0 && (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {conflicts.map((conflict) => {
                  const isCrit = conflict.severity === 'critical'
                  return (
                    <div
                      key={conflict.id}
                      className={cn(
                        'p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-sm',
                        isCrit
                          ? 'border-rose-500/40 bg-zinc-950/80 ring-1 ring-rose-500/20'
                          : 'border-amber-500/30 bg-zinc-950/60'
                      )}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-md border',
                                isCrit
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              )}
                            >
                              {isCrit ? 'NGHIÊM TRỌNG' : 'CẢNH BÁO'}
                            </span>
                            <h4 className="text-xs font-bold text-foreground truncate">
                              {conflict.title}
                            </h4>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-300/90 leading-relaxed">
                          {conflict.description}
                        </p>

                        {conflict.involvedMods.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Các mod liên quan:
                            </span>
                            {conflict.involvedMods.map((m, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300"
                              >
                                {m.name || m.fileName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <ShieldCheck size={12} className="text-primary" />
                          Hành động khắc phục:
                        </span>

                        <Button
                          size="sm"
                          disabled={isResolving}
                          onClick={() =>
                            onResolve({
                              conflictId: conflict.id,
                              action: conflict.recommendedAction,
                              targetFileName: conflict.targetFileName,
                              companionModSlug: conflict.companionModInfo?.slug,
                            })
                          }
                          className={cn(
                            'h-7 px-3 text-xs font-semibold gap-1.5 shadow-sm',
                            isCrit
                              ? 'bg-rose-600 hover:bg-rose-500 text-white'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                          )}
                        >
                          {getActionIcon(conflict.recommendedAction)}
                          {conflict.actionLabel}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
