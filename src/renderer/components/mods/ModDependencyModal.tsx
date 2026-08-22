import React from 'react'
import { RefreshCw, Loader2, Sparkles, CheckCircle2, AlertCircle, Download } from 'lucide-react'
import type { ModDependencyScanResult, AutoFixDependenciesResult } from '@/shared/types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/button'

interface ModDependencyModalProps {
  isOpen: boolean
  onClose: () => void
  profileName?: string
  isScanning: boolean
  isFixing: boolean
  scanResult: ModDependencyScanResult | null
  fixResult: AutoFixDependenciesResult | null
  onRescan: () => void
  onAutoFix: () => void
}

export const ModDependencyModal: React.FC<ModDependencyModalProps> = ({
  isOpen,
  onClose,
  profileName,
  isScanning,
  isFixing,
  scanResult,
  fixResult,
  onRescan,
  onAutoFix,
}) => {
  const missingDeps = scanResult?.missingDependencies || []
  const hasMissing = missingDeps.length > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kiểm tra & Tự động sửa Mod (Inspector & Auto-Fixer)"
      description={`Phân tích cây phụ thuộc của các mod trong cấu hình: ${profileName || 'Hiện tại'}`}
      maxWidth="max-w-[700px]"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onRescan}
            disabled={isScanning || isFixing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            Quét lại
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Đóng
            </Button>
            {hasMissing && (
              <Button
                variant="primary"
                size="sm"
                onClick={onAutoFix}
                disabled={isFixing || isScanning}
                className="shadow-md shadow-primary/20 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
              >
                {isFixing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải & sửa...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Tự động tải {missingDeps.length} mod thiếu
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {isScanning ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Đang trích xuất metadata và phân tích các mod...</p>
          </div>
        ) : (
          <>
            {/* Fix Notification */}
            {fixResult && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-sm ${
                  fixResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {fixResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{fixResult.message}</p>
                  {fixResult.downloadedMods?.length > 0 && (
                    <ul className="mt-1 list-disc list-inside text-xs opacity-90">
                      {fixResult.downloadedMods.map((dm, i) => (
                        <li key={i}>
                          {dm.title} ({dm.fileName})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Status Banner */}
            {!hasMissing ? (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-emerald-300">Tất cả Mod đã đầy đủ</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Đã quét {scanResult?.totalMods || 0} mod. Toàn bộ các mod phụ thuộc (dependencies)
                    cần thiết đều đã được cài đặt.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-300">
                    Phát hiện {missingDeps.length} mod phụ thuộc còn thiếu
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nếu không cài các mod này, game có thể bị crash khi khởi chạy. Bạn có thể bấm nút Tự
                    động tải bên dưới để sửa nhanh.
                  </p>
                </div>
              </div>
            )}

            {/* Missing Dependencies List */}
            {hasMissing && (
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Danh sách Mod cần bổ sung
                </h4>
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {missingDeps.map((dep, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {dep.resolvedProject?.title || dep.modId}
                          </span>
                          {dep.versionRange && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                              {dep.versionRange}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Yêu cầu bởi mod: <span className="text-zinc-200">{dep.requiredByFileName || dep.requiredBy}</span>
                        </p>
                      </div>
                      <div className="shrink-0">
                        {dep.resolvedProject?.downloadUrl ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
                            <Download className="h-3 w-3" />
                            Sẵn sàng tải
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-zinc-800 px-2 py-1 rounded-md">
                            Cần cài thủ công
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
