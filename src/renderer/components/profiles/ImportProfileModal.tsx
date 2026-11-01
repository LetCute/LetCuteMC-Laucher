import { useState, useEffect } from 'react'
import {
  Package,
  Box,
  Settings2,
  Sliders,
  Server,
  Zap,
  Image,
  Loader2,
  AlertCircle,
  Download,
  User,
} from 'lucide-react'
import type { LauncherProfile, PackagePreviewInfo } from '@/shared/types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/button'
import { Input } from '../ui/Input'
import { launcherClient } from '../../services/launcherClient'
import { useToast } from '../ui/Toast'

interface ImportProfileModalProps {
  isOpen: boolean
  onClose: () => void
  packagePath: string | null
  onSuccess: (newProfile: LauncherProfile) => void
}

const resolveLoader = (manifestLoader?: string, versionStr?: string): string => {
  if (manifestLoader && manifestLoader !== 'vanilla') return manifestLoader
  const v = (versionStr || '').toLowerCase()
  if (v.includes('neoforge')) return 'neoforge'
  if (v.includes('fabric')) return 'fabric'
  if (v.includes('forge')) return 'forge'
  if (v.includes('quilt')) return 'quilt'
  return 'vanilla'
}

const getLoaderIcon = (loader: string) => {
  switch (loader) {
    case 'fabric':
      return './assets/fabric.png'
    case 'neoforge':
      return './assets/neoforged.png'
    case 'forge':
      return './assets/forge.png'
    case 'quilt':
      return './assets/quilt.svg'
    default:
      return './assets/grass_block.png'
  }
}

export function ImportProfileModal({
  isOpen,
  onClose,
  packagePath,
  onSuccess,
}: ImportProfileModalProps) {
  const { showToast } = useToast()

  const [previewInfo, setPreviewInfo] = useState<PackagePreviewInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [customName, setCustomName] = useState('')

  useEffect(() => {
    if (isOpen && packagePath) {
      void loadPreview(packagePath)
    } else {
      setPreviewInfo(null)
      setCustomName('')
    }
  }, [isOpen, packagePath])

  const loadPreview = async (filePath: string) => {
    setIsLoading(true)
    try {
      const data = await launcherClient.readProfilePackageInfo(filePath)
      setPreviewInfo(data)
      if (data.valid && data.manifest) {
        setCustomName(data.manifest.name)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể đọc tệp gói cấu hình.'
      setPreviewInfo({
        valid: false,
        fileName: '',
        filePath,
        fileSizeBytes: 0,
        error: message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!packagePath || !previewInfo?.valid) return

    try {
      setIsImporting(true)
      const res = await launcherClient.importProfilePackage(
        packagePath,
        customName.trim() || undefined
      )

      if (res.success && res.profile) {
        showToast('success', `Đã nhập cấu hình "${res.profile.name}" thành công!`)
        onSuccess(res.profile)
        onClose()
      } else {
        showToast('error', res.error || 'Nhập cấu hình thất bại.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi nhập cấu hình.'
      showToast('error', message)
    } finally {
      setIsImporting(false)
    }
  }

  const sizeMb = previewInfo?.fileSizeBytes
    ? (previewInfo.fileSizeBytes / (1024 * 1024)).toFixed(1)
    : '0'

  const manifest = previewInfo?.manifest

  return (
    <Modal
      isOpen={isOpen}
      onClose={isImporting ? () => {} : onClose}
      title="Nhập Gói Cấu Hình Game"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs select-none">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-semibold text-zinc-200">Đang đọc dữ liệu gói cấu hình...</p>
          </div>
        ) : !previewInfo?.valid ? (
          <div className="p-4 rounded-md border border-red-800/60 bg-red-950/20 flex items-start gap-3 text-red-300">
            <AlertCircle size={20} className="shrink-0 text-red-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold">Không thể nạp tệp này</p>
              <p className="text-xs text-red-400/90">
                {previewInfo?.error || 'Tệp cấu hình không hợp lệ hoặc bị lỗi định dạng.'}
              </p>
            </div>
          </div>
        ) : (
          manifest && (
            <>
              {/* Package Banner Header */}
              {(() => {
                const effectiveLoader = resolveLoader(manifest.loader, manifest.minecraftVersion)
                return (
                  <div className="p-4 rounded-md border border-primary/40 bg-primary/10 flex items-center justify-between gap-3 shadow-md">
                    <div className="flex items-center gap-3 min-w-0">
                      {previewInfo?.iconData ? (
                        <img
                          src={previewInfo.iconData}
                          alt="Icon Modpack"
                          className="h-11 w-11 rounded-md object-cover border border-primary/40 shrink-0 bg-black/40 shadow-sm"
                        />
                      ) : (
                        <img
                          src={getLoaderIcon(effectiveLoader)}
                          alt={effectiveLoader}
                          className="h-11 w-11 rounded-md object-contain p-1 border border-primary/30 shrink-0 bg-black/30 shadow-sm"
                        />
                      )}
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-foreground truncate">{manifest.name}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>
                            Phiên bản: <strong className="text-zinc-200">{manifest.minecraftVersion}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Dung lượng: <strong className="text-primary">{sizeMb} MB</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 capitalize ${
                        effectiveLoader === 'neoforge' || effectiveLoader === 'forge'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : effectiveLoader === 'fabric' || effectiveLoader === 'quilt'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      {effectiveLoader === 'neoforge'
                        ? 'NeoForge'
                        : effectiveLoader === 'fabric'
                          ? 'Fabric'
                          : effectiveLoader === 'forge'
                            ? 'Forge'
                            : effectiveLoader === 'quilt'
                              ? 'Quilt'
                              : 'Vanilla'}
                    </span>
                  </div>
                )
              })()}

              {/* Author & Description */}
              {(manifest.author || manifest.description) && (
                <div className="p-3 rounded-md border border-zinc-800/80 bg-zinc-900/80 space-y-1 text-[11px]">
                  {manifest.author && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <User size={13} className="text-zinc-500" />
                      <span>Người tạo: <strong className="text-zinc-200">{manifest.author}</strong></span>
                    </div>
                  )}
                  {manifest.description && (
                    <p className="text-zinc-300 italic">"{manifest.description}"</p>
                  )}
                </div>
              )}

              {/* Included features list */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Thành phần có trong gói
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {manifest.includedFeatures.mods && (
                    <div className="p-2 rounded-md bg-zinc-900/90 border border-zinc-800 flex items-center gap-2 text-zinc-200">
                      <Box size={13} className="text-primary" />
                      <span className="text-[11px] font-medium truncate">
                        Mods ({manifest.modsCount || 'Có'})
                      </span>
                    </div>
                  )}

                  {manifest.includedFeatures.config && (
                    <div className="p-2 rounded-md bg-zinc-900/90 border border-zinc-800 flex items-center gap-2 text-zinc-200">
                      <Settings2 size={13} className="text-primary" />
                      <span className="text-[11px] font-medium truncate">Cài đặt Config</span>
                    </div>
                  )}

                  {manifest.includedFeatures.options && (
                    <div className="p-2 rounded-md bg-zinc-900/90 border border-zinc-800 flex items-center gap-2 text-zinc-200">
                      <Sliders size={13} className="text-primary" />
                      <span className="text-[11px] font-medium truncate">Phím & Đồ họa</span>
                    </div>
                  )}

                  {manifest.includedFeatures.shaderpacks && (
                    <div className="p-2 rounded-md bg-zinc-900/90 border border-zinc-800 flex items-center gap-2 text-zinc-200">
                      <Zap size={13} className="text-primary" />
                      <span className="text-[11px] font-medium truncate">Shader Packs</span>
                    </div>
                  )}

                  {manifest.includedFeatures.resourcepacks && (
                    <div className="p-2 rounded-md bg-zinc-900/90 border border-zinc-800 flex items-center gap-2 text-zinc-200">
                      <Image size={13} className="text-primary" />
                      <span className="text-[11px] font-medium truncate">Resource Packs</span>
                    </div>
                  )}

                  {manifest.includedFeatures.servers && (
                    <div className="p-2 rounded-md bg-zinc-900/90 border border-zinc-800 flex items-center gap-2 text-zinc-200">
                      <Server size={13} className="text-primary" />
                      <span className="text-[11px] font-medium truncate">Máy chủ</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Profile Name Input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-zinc-300">
                  Tên Cấu hình Trong Launcher
                </label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Nhập tên cấu hình..."
                  className="h-9 text-xs bg-zinc-900/90 border-zinc-800 font-semibold text-foreground"
                  disabled={isImporting}
                />
              </div>
            </>
          )
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
          <Button
            onClick={onClose}
            disabled={isImporting}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs bg-zinc-900/90 border-zinc-800"
          >
            Hủy
          </Button>

          {previewInfo?.valid && (
            <Button
              onClick={handleImport}
              disabled={isImporting || !customName.trim()}
              size="sm"
              className="h-8 px-4 text-xs font-semibold gap-1.5"
            >
              {isImporting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Đang giải nén & tạo cấu hình...
                </>
              ) : (
                <>
                  <Download size={13} />
                  Nhập Cấu Hình Ngay
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
