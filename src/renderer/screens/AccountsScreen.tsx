import { useState, useRef, useEffect } from 'react'
import type { AccountState } from '@/shared/types.ts'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { SkinViewer3D, type SkinModel } from '../components/ui/SkinViewer3D'
import { CapePreview } from '../components/ui/CapePreview'
import {
  Key,
  FlaskConical,
  Trash2,
  PlusCircle,
  Check,
  Upload,
  Crown,
  ImagePlus,
  UserCircle,
  Loader2,
  XCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SkinData {
  url: string
  model: SkinModel
}

interface AccountsScreenProps {
  accountState: AccountState
  onAccountStateChange: (state: AccountState) => void
  appendLog: (level: 'info' | 'success' | 'warn' | 'error', message: string) => void
  isWorking?: boolean
}

// Helper to convert base64 data URL to ArrayBuffer for uploading
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1]
  const binaryString = window.atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

export const AccountsScreen = ({
  accountState,
  onAccountStateChange,
  appendLog,
  isWorking,
}: AccountsScreenProps) => {
  const { showToast } = useToast()
  const [newLocalUsername, setNewLocalUsername] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLocalInput, setShowLocalInput] = useState(false)
  
  const skinInputRef = useRef<HTMLInputElement>(null)
  const capeInputRef = useRef<HTMLInputElement>(null)

  // Persist skin and cape data in localStorage
  const [skinMap, setSkinMap] = useState<Record<string, SkinData>>(() => {
    try {
      const saved = localStorage.getItem('letcutemc_skinMap')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [modelMap, setModelMap] = useState<Record<string, SkinModel>>(() => {
    try {
      const saved = localStorage.getItem('letcutemc_modelMap')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [capeMap, setCapeMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('letcutemc_capeMap')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  // Save to localStorage when they change
  useEffect(() => {
    localStorage.setItem('letcutemc_skinMap', JSON.stringify(skinMap))
  }, [skinMap])
  useEffect(() => {
    localStorage.setItem('letcutemc_modelMap', JSON.stringify(modelMap))
  }, [modelMap])
  useEffect(() => {
    localStorage.setItem('letcutemc_capeMap', JSON.stringify(capeMap))
  }, [capeMap])

  // Skin change modal state
  const [showSkinModal, setShowSkinModal] = useState(false)
  const [skinModalTargetId, setSkinModalTargetId] = useState<string | null>(null)
  const [skinModalTargetType, setSkinModalTargetType] = useState<'local' | 'microsoft'>('local')
  const [skinModalTargetName, setSkinModalTargetName] = useState('')
  
  const [pendingSkinFile, setPendingSkinFile] = useState<string | null>(null)
  const [pendingSkinModel, setPendingSkinModel] = useState<SkinModel>('default')
  const [pendingCapeFile, setPendingCapeFile] = useState<string | null>(null)
  const [pendingCapeId, setPendingCapeId] = useState<string>('') // For Premium owned capes
  
  const [isFetchingMojang, setIsFetchingMojang] = useState(false)
  const [isSavingMojang, setIsSavingMojang] = useState(false)
  const [mojangProfile, setMojangProfile] = useState<any>(null)

  const handleMicrosoftLogin = async () => {
    setShowAddModal(false)
    try {
      const account = await window.launcherApi.loginMicrosoft()
      const updated = await window.launcherApi.saveMicrosoftAccount(account)
      onAccountStateChange(updated)
      appendLog('success', `Đã đăng nhập tài khoản Microsoft: ${account.username}`)
      showToast('success', `Đã đăng nhập: ${account.username}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi đăng nhập'
      appendLog('error', msg)
      showToast('error', msg)
    }
  }

  const handleAddLocalAccount = async () => {
    if (!newLocalUsername || newLocalUsername.trim().length === 0) {
      showToast('error', 'Vui lòng nhập tên tài khoản.')
      return
    }
    try {
      const updated = await window.launcherApi.addLocalAccount(newLocalUsername)
      onAccountStateChange(updated)
      setNewLocalUsername('')
      setShowLocalInput(false)
      setShowAddModal(false)
      appendLog('success', `Đã tạo tài khoản Local mới: ${newLocalUsername}`)
      showToast('success', `Đã tạo tài khoản: ${newLocalUsername}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi tạo tài khoản'
      appendLog('error', msg)
      showToast('error', msg)
    }
  }

  const handleSelectAccount = async (id: string) => {
    try {
      const updated = await window.launcherApi.selectAccount(id)
      onAccountStateChange(updated)
      appendLog('info', `Đã chuyển sang tài khoản: ${updated.accounts.find((a: any) => a.id === id)?.username}`)
    } catch (e) {
      appendLog('error', e instanceof Error ? e.message : 'Lỗi chuyển tài khoản')
    }
  }

  const handleRemoveAccount = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${name}"?`)) return
    try {
      const updated = await window.launcherApi.removeAccount(id)
      onAccountStateChange(updated)
      appendLog('info', `Đã xóa tài khoản: ${name}`)
    } catch (e) {
      appendLog('error', e instanceof Error ? e.message : 'Lỗi xóa tài khoản')
    }
  }

  // Open the skin change modal for a specific account
  const openSkinModal = async (accountId: string, accountName: string, accountType: 'local' | 'microsoft', accessToken?: string) => {
    setSkinModalTargetId(accountId)
    setSkinModalTargetType(accountType)
    setSkinModalTargetName(accountName)
    setShowSkinModal(true)
    setMojangProfile(null)

    if (accountType === 'microsoft' && accessToken) {
      setIsFetchingMojang(true)
      try {
        const profile = await window.launcherApi.getMojangProfile(accessToken)
        setMojangProfile(profile)
        
        // Find active skin
        const activeSkin = profile.skins?.find((s: any) => s.state === 'ACTIVE')
        if (activeSkin) {
          const base64Skin = await window.launcherApi.fetchMojangTexture(activeSkin.url)
          setPendingSkinFile(base64Skin || activeSkin.url)
          setPendingSkinModel(activeSkin.variant === 'SLIM' ? 'slim' : 'default')
          // Cache to localStorage (use original URL for storage size, base64 for preview)
          setSkinMap(prev => ({ ...prev, [accountId]: { url: base64Skin || activeSkin.url, model: activeSkin.variant === 'SLIM' ? 'slim' : 'default' } }))
          setModelMap(prev => ({ ...prev, [accountId]: activeSkin.variant === 'SLIM' ? 'slim' : 'default' }))
        } else {
          setPendingSkinFile(null)
          setPendingSkinModel('default')
        }

        // Find active cape
        const activeCape = profile.capes?.find((c: any) => c.state === 'ACTIVE')
        if (activeCape) {
          setPendingCapeId(activeCape.id)
          const base64Cape = await window.launcherApi.fetchMojangTexture(activeCape.url)
          setPendingCapeFile(base64Cape || activeCape.url)
          // Cache to localStorage
          setCapeMap(prev => ({ ...prev, [accountId]: base64Cape || activeCape.url }))
        } else {
          setPendingCapeId('')
          setPendingCapeFile(null)
          setCapeMap(prev => { const nm = {...prev}; delete nm[accountId]; return nm })
        }
      } catch (err) {
        showToast('error', 'Không thể lấy thông tin từ Mojang.')
        // Fallback to local cache
        setPendingSkinFile(skinMap[accountId]?.url || null)
        setPendingSkinModel(modelMap[accountId] || 'default')
        setPendingCapeFile(capeMap[accountId] || null)
      } finally {
        setIsFetchingMojang(false)
      }
    } else {
      // Local account, load from cache
      setPendingSkinModel(modelMap[accountId] || 'default')
      setPendingSkinFile(skinMap[accountId]?.url || null)
      setPendingCapeFile(capeMap[accountId] || null)
    }
  }

  const closeSkinModal = () => {
    if (isSavingMojang || isFetchingMojang) return
    setShowSkinModal(false)
    setSkinModalTargetId(null)
    setSkinModalTargetName('')
    setPendingSkinFile(null)
    setPendingSkinModel('default')
    setPendingCapeFile(null)
    setPendingCapeId('')
    setMojangProfile(null)
  }

  const handleSkinFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPendingSkinFile(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCapeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPendingCapeFile(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSkinConfirm = async () => {
    if (!skinModalTargetId) return

    if (skinModalTargetType === 'microsoft') {
      // Upload to Mojang Server
      const acc = accountState.accounts.find(a => a.id === skinModalTargetId)
      if (!acc || acc.type !== 'microsoft' || !acc.accessToken) return

      setIsSavingMojang(true)
      try {
        let profileChanged = false

        // Check if skin needs upload (if it's a data url, it's a new file)
        if (pendingSkinFile && pendingSkinFile.startsWith('data:image')) {
          const buffer = dataUrlToArrayBuffer(pendingSkinFile)
          const apiVariant = pendingSkinModel === 'slim' ? 'slim' : 'classic'
          await window.launcherApi.uploadMojangSkin(acc.accessToken, buffer, apiVariant)
          profileChanged = true
        }

        // Check if cape needs change
        const currentActiveCapeId = mojangProfile?.capes?.find((c: any) => c.state === 'ACTIVE')?.id || ''
        if (pendingCapeId !== currentActiveCapeId) {
          await window.launcherApi.changeMojangCape(acc.accessToken, pendingCapeId)
          profileChanged = true
        }

        if (profileChanged) {
          showToast('success', 'Đã cập nhật Skin/Cape trên Mojang!')
          // Re-fetch to update caches
          const profile = await window.launcherApi.getMojangProfile(acc.accessToken)
          const activeSkin = profile.skins?.find((s: any) => s.state === 'ACTIVE')
          if (activeSkin) {
            setSkinMap(prev => ({ ...prev, [skinModalTargetId]: { url: activeSkin.url, model: activeSkin.variant === 'SLIM' ? 'slim' : 'default' } }))
            setModelMap(prev => ({ ...prev, [skinModalTargetId]: activeSkin.variant === 'SLIM' ? 'slim' : 'default' }))
          }
          const activeCape = profile.capes?.find((c: any) => c.state === 'ACTIVE')
          if (activeCape) {
            setCapeMap(prev => ({ ...prev, [skinModalTargetId]: activeCape.url }))
          } else {
            setCapeMap(prev => { const nm = {...prev}; delete nm[skinModalTargetId]; return nm })
          }
        }
        closeSkinModal()
      } catch (err) {
        showToast('error', `Lỗi khi lưu lên Mojang: ${(err as Error).message}`)
      } finally {
        setIsSavingMojang(false)
      }
    } else {
      // Local account: just save to localStorage
      if (pendingSkinFile) {
        setSkinMap(prev => ({
          ...prev,
          [skinModalTargetId]: { url: pendingSkinFile, model: pendingSkinModel },
        }))
        setModelMap(prev => ({
          ...prev,
          [skinModalTargetId]: pendingSkinModel,
        }))
      }
      if (pendingCapeFile) {
        setCapeMap(prev => ({ ...prev, [skinModalTargetId]: pendingCapeFile }))
      } else {
        setCapeMap(prev => { const nm = {...prev}; delete nm[skinModalTargetId]; return nm })
      }
      showToast('success', 'Đã cập nhật ngoại hình Local!')
      closeSkinModal()
    }
  }

  const handleCloseAddModal = () => {
    setShowAddModal(false)
    setShowLocalInput(false)
    setNewLocalUsername('')
  }

  const accounts = accountState?.accounts || []

  return (
    <div className="px-6 pt-2 pb-6 h-full flex flex-col gap-5">
      {/* Hidden file inputs */}
      <input ref={skinInputRef} type="file" accept="image/png" className="hidden" onChange={handleSkinFileChange} />
      <input ref={capeInputRef} type="file" accept="image/png" className="hidden" onChange={handleCapeFileChange} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Tài khoản</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý và chuyển đổi giữa các tài khoản của bạn
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} disabled={isWorking} variant="primary" size="sm" className="h-9 px-3">
          <PlusCircle size={14} className="mr-1.5" />
          Thêm tài khoản
        </Button>
      </div>

      {/* Account Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {accounts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {accounts.map(acc => {
              const isActive = acc.id === accountState?.activeAccountId
              const isLocal = acc.type === 'local'
              const skinData = skinMap[acc.id]
              const capeData = capeMap[acc.id]
              const accModel = modelMap[acc.id] || 'default'

              return (
                <div
                  key={acc.id}
                  onClick={() => !isActive && !isWorking && handleSelectAccount(acc.id)}
                  className={[
                    'group relative flex flex-col items-center rounded-2xl border p-4 transition-all duration-200 cursor-pointer',
                    isWorking ? 'opacity-60 cursor-not-allowed' : '',
                    isActive
                      ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/25 shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_12%,transparent)]'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-accent/30 hover:shadow-lg hover:-translate-y-0.5',
                  ].join(' ')}
                >
                  {/* Active badge */}
                  {isActive && (
                    <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md z-10">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span
                      className={[
                        'flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm',
                        isLocal
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                      ].join(' ')}
                    >
                      {isLocal ? <FlaskConical size={9} /> : <Crown size={9} />}
                      {isLocal ? 'Local' : 'Microsoft'}
                    </span>
                  </div>

                  {/* Delete button */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost" size="icon-sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/15 text-muted-foreground hover:text-destructive rounded-lg"
                      title="Xóa tài khoản"
                      onClick={() => handleRemoveAccount(acc.id, acc.username)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>

                  {/* 3D Skin viewer area */}
                  <div
                    className="relative mt-2 mb-2 group/skin cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      openSkinModal(acc.id, acc.username, acc.type, (acc as any).accessToken)
                    }}
                    title="Đổi ngoại hình"
                  >
                    <SkinViewer3D
                      skinUrl={
                        skinData?.url
                          ? skinData.url
                          : acc.type === 'microsoft'
                            ? `https://mc-heads.net/skin/${acc.username}`
                            : undefined
                      }
                      capeUrl={capeData}
                      model={accModel}
                      width={120} height={130}
                      autoRotate rotateSpeed={0.5}
                    />
                    {/* Upload overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover/skin:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 pointer-events-none">
                      <ImagePlus size={16} className="text-white/80" />
                      <span className="text-[9px] text-white/70 font-medium">Sửa ngoại hình</span>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="text-center w-full min-w-0">
                    <p className={['text-sm font-bold truncate transition-colors', isActive ? 'text-primary' : 'text-foreground'].join(' ')}>
                      {acc.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      UUID: {acc.uuid.slice(0, 8)}...
                    </p>
                  </div>
                  {isActive && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary/60" />}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
            <div className="h-16 w-16 rounded-2xl bg-accent/50 border border-border flex items-center justify-center">
              <UserCircle size={28} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Chưa có tài khoản nào</p>
            <p className="text-xs text-muted-foreground/60">Bấm "Thêm tài khoản" để bắt đầu</p>
          </div>
        )}
      </div>

      {/* ── Skin/Cape Change Modal ── */}
      <Modal
        isOpen={showSkinModal}
        onClose={closeSkinModal}
        title={`Ngoại hình – ${skinModalTargetName}`}
        description={skinModalTargetType === 'microsoft' ? "Chỉnh sửa Skin & Cape trực tiếp trên server Mojang" : "Chỉnh sửa Skin & Cape (Local)"}
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={closeSkinModal} disabled={isSavingMojang || isFetchingMojang}>Hủy</Button>
            <Button variant="primary" onClick={handleSkinConfirm} disabled={isSavingMojang || isFetchingMojang || (!pendingSkinFile && !pendingCapeFile && skinModalTargetType === 'local')}>
              {isSavingMojang ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Check size={14} className="mr-1" />}
              {isSavingMojang ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5 min-h-[300px]">
          {isFetchingMojang ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Đang tải thông tin từ Mojang...</p>
            </div>
          ) : (
            <div className="flex items-stretch gap-6">
              {/* 3D preview */}
              <div className="shrink-0 rounded-xl border border-border bg-accent/20 p-2 flex items-center justify-center w-[160px]">
                <SkinViewer3D
                  skinUrl={pendingSkinFile || undefined}
                  capeUrl={pendingCapeFile || undefined}
                  model={pendingSkinModel}
                  width={140}
                  height={200}
                  autoRotate
                  rotateSpeed={0.8}
                />
              </div>

              {/* Controls */}
              <div className="flex-1 flex flex-col gap-6">
                
                {/* 1. Skin Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">Skin (Giao diện)</label>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => skinInputRef.current?.click()}>
                      <Upload size={12} className="mr-1.5 text-muted-foreground" /> Chọn file mới
                    </Button>
                  </div>
                  
                  {/* Arm type selector */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPendingSkinModel('default')}
                      className={['flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all duration-200', pendingSkinModel === 'default' ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40'].join(' ')}
                    >
                      <div className="flex items-end gap-0.5">
                        <div className={['w-2 h-5 rounded-sm', pendingSkinModel === 'default' ? 'bg-primary' : 'bg-muted-foreground/40'].join(' ')} />
                        <div className={['w-3.5 h-6 rounded-sm', pendingSkinModel === 'default' ? 'bg-primary/70' : 'bg-muted-foreground/25'].join(' ')} />
                        <div className={['w-2 h-5 rounded-sm', pendingSkinModel === 'default' ? 'bg-primary' : 'bg-muted-foreground/40'].join(' ')} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={['text-xs font-bold', pendingSkinModel === 'default' ? 'text-primary' : 'text-foreground'].join(' ')}>Classic</p>
                        <p className="text-[9px] text-muted-foreground">Tay rộng</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingSkinModel('slim')}
                      className={['flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all duration-200', pendingSkinModel === 'slim' ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40'].join(' ')}
                    >
                      <div className="flex items-end gap-0.5">
                        <div className={['w-1.5 h-5 rounded-sm', pendingSkinModel === 'slim' ? 'bg-primary' : 'bg-muted-foreground/40'].join(' ')} />
                        <div className={['w-3.5 h-6 rounded-sm', pendingSkinModel === 'slim' ? 'bg-primary/70' : 'bg-muted-foreground/25'].join(' ')} />
                        <div className={['w-1.5 h-5 rounded-sm', pendingSkinModel === 'slim' ? 'bg-primary' : 'bg-muted-foreground/40'].join(' ')} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={['text-xs font-bold', pendingSkinModel === 'slim' ? 'text-primary' : 'text-foreground'].join(' ')}>Slim</p>
                        <p className="text-[9px] text-muted-foreground">Tay mảnh</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-border/50 w-full" />

                {/* 2. Cape Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">Cape (Áo choàng)</label>
                    {skinModalTargetType === 'local' && (
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => capeInputRef.current?.click()}>
                        <Upload size={12} className="mr-1.5 text-muted-foreground" /> Chọn file cape
                      </Button>
                    )}
                  </div>

                  {skinModalTargetType === 'local' ? (
                    <div className="flex items-center gap-3">
                      {pendingCapeFile ? (
                        <div className="flex-1 flex items-center justify-between p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                          <span className="text-xs font-medium text-primary">Đã nạp file áo choàng ✓</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:bg-destructive/10" onClick={() => setPendingCapeFile(null)}>
                            Gỡ bỏ
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Chưa có áo choàng. Bạn có thể tự upload file ảnh cape (.png) bất kỳ.</p>
                      )}
                    </div>
                  ) : (
                    // Microsoft Capes
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => { setPendingCapeId(''); setPendingCapeFile(null) }}
                        className={['flex items-center gap-2 p-2 rounded-lg border transition-all', pendingCapeId === '' ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40'].join(' ')}
                      >
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <XCircle size={14} className="text-muted-foreground" />
                        </div>
                        <span className={['text-xs font-medium text-left truncate', pendingCapeId === '' ? 'text-primary' : 'text-foreground'].join(' ')}>Không dùng</span>
                      </button>
                      
                      {mojangProfile?.capes?.map((cape: any) => (
                        <button
                          key={cape.id}
                          type="button"
                          onClick={() => { setPendingCapeId(cape.id); setPendingCapeFile(cape.url) }}
                          className={['flex items-center gap-3 p-2 rounded-lg border transition-all', pendingCapeId === cape.id ? 'border-primary bg-primary/10 shadow-[0_0_8px_rgba(var(--primary),0.2)]' : 'border-border bg-card hover:border-primary/40'].join(' ')}
                        >
                          <CapePreview capeUrl={cape.url} width={20} height={32} className="shrink-0 drop-shadow-md" />
                          <span className={['text-xs font-bold text-left truncate', pendingCapeId === cape.id ? 'text-primary' : 'text-foreground'].join(' ')}>
                            {cape.alias || 'Cape'}
                          </span>
                        </button>
                      ))}
                      {mojangProfile?.capes?.length === 0 && (
                        <div className="col-span-2 p-3 text-center rounded-lg border border-dashed border-border">
                          <span className="text-xs text-muted-foreground">Tài khoản này không sở hữu áo choàng nào.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Add Account Modal ── */}
      <Modal
        isOpen={showAddModal}
        onClose={handleCloseAddModal}
        title="Thêm tài khoản"
        description="Chọn loại tài khoản bạn muốn thêm"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-3">
          {/* Microsoft Option */}
          <button
            onClick={handleMicrosoftLogin} disabled={isWorking}
            className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left disabled:opacity-50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20">
              <Key size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Tài khoản Microsoft</p>
              <p className="text-xs text-muted-foreground mt-0.5">Đăng nhập bản quyền Microsoft</p>
            </div>
            <div className="shrink-0 text-muted-foreground group-hover:text-emerald-400">
              <PlusCircle size={18} />
            </div>
          </button>

          {/* Local Option */}
          {!showLocalInput ? (
            <button
              onClick={() => setShowLocalInput(true)} disabled={isWorking}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-left disabled:opacity-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20">
                <FlaskConical size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">Tài khoản Local (Offline)</p>
                <p className="text-xs text-muted-foreground mt-0.5">Khởi tạo nhanh, chơi offline</p>
              </div>
              <div className="shrink-0 text-muted-foreground group-hover:text-amber-400">
                <PlusCircle size={18} />
              </div>
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-center gap-2">
                <FlaskConical size={16} className="text-amber-400" />
                <span className="text-sm font-bold text-foreground">Tạo tài khoản Local</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    disabled={isWorking} value={newLocalUsername}
                    onChange={(e) => setNewLocalUsername(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleAddLocalAccount() }}
                    placeholder="Tên người chơi..." className="h-9" autoFocus
                  />
                </div>
                <Button onClick={() => void handleAddLocalAccount()} disabled={isWorking || !newLocalUsername.trim()} variant="primary" className="h-9">
                  <Upload size={14} className="mr-1" /> Tạo
                </Button>
              </div>
              <button onClick={() => { setShowLocalInput(false); setNewLocalUsername('') }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Quay lại
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
