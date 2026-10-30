import { useState, useRef, lazy, Suspense } from 'react'
import type { AccountState } from '@/shared/types.ts'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { SkinViewer3D, type SkinModel } from '../components/ui/SkinViewer3D'
import { CapePreview } from '../components/ui/CapePreview'
import {
  FlaskConical,
  Trash2,
  PlusCircle,
  Check,
  Upload,
  Crown,
  UserCircle,
  Loader2,
  XCircle,
  Pencil,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { NameMCCape } from '../data/namemcCapes'
import { useAccounts } from '../hooks/useAccounts'
import AddAccountModal from '../components/accounts/AddAccountModal'

const NameMCSkinGallery = lazy(() => import('../components/accounts/NameMCSkinGallery'))
const NameMCCapeGallery = lazy(() => import('../components/accounts/NameMCCapeGallery'))

interface AccountsScreenProps {
  accountState: AccountState
  onAccountStateChange: (state: AccountState) => void
  appendLog: (level: 'info' | 'success' | 'warn' | 'error', message: string) => void
  isWorking?: boolean
}

// Helper to convert base64 data URL to ArrayBuffer for uploading
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1] ?? ''
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
  const confirm = useConfirm()
  const [showAddModal, setShowAddModal] = useState(false)

  const skinInputRef = useRef<HTMLInputElement>(null)
  const capeInputRef = useRef<HTMLInputElement>(null)

  // Skin change modal state
  const [showSkinModal, setShowSkinModal] = useState(false)
  const [skinModalTargetId, setSkinModalTargetId] = useState<string | null>(null)
  const [skinModalTargetType, setSkinModalTargetType] = useState<'local' | 'microsoft'>('local')
  const [skinModalTargetName, setSkinModalTargetName] = useState('')

  const [pendingSkinFile, setPendingSkinFile] = useState<string | null>(null)
  const [pendingSkinModel, setPendingSkinModel] = useState<SkinModel>('default')
  const [pendingCapeFile, setPendingCapeFile] = useState<string | null>(null)
  const [pendingCapeId, setPendingCapeId] = useState<string>('') // For Premium owned capes
  const [skinTab, setSkinTab] = useState<'name' | 'skin' | 'cape'>('skin')

  // NameMC Skin & Cape state
  const [namemcInput, setNamemcInput] = useState('')
  const [isImportingNamemc, setIsImportingNamemc] = useState(false)
  const [renameAllowed, setRenameAllowed] = useState(true)
  const [renameCooldownMessage, setRenameCooldownMessage] = useState('')
  const [isCheckingRename, setIsCheckingRename] = useState(false)
  const [isSavingRename, setIsSavingRename] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [renameTargetId, setRenameTargetId] = useState('')
  const [renameTargetName, setRenameTargetName] = useState('')
  const [renameTargetType, setRenameTargetType] = useState<'local' | 'microsoft'>('local')

  const [isFetchingMojang, setIsFetchingMojang] = useState(false)
  const [isSavingMojang, setIsSavingMojang] = useState(false)
  const [mojangProfile, setMojangProfile] = useState<any>(null)
  const [selectedCapeUrl, setSelectedCapeUrl] = useState<string | null>(null)

  const {
    accounts,
    activeAccountId,
    selectAccount,
    removeAccount,
    addLocalAccount,
    loginMicrosoft,
  } = useAccounts({
    initialState: accountState,
    onStateChange: onAccountStateChange,
    appendLog,
  })

  const handleMicrosoftLogin = async () => {
    setShowAddModal(false)
    await loginMicrosoft()
  }

  const handleAddLocalAccount = async (username: string) => {
    if (!username || username.trim().length === 0) {
      showToast('error', 'Vui lòng nhập tên tài khoản.')
      return false
    }
    const res = await addLocalAccount(username)
    return !!res
  }

  const handleSelectAccount = async (id: string) => {
    await selectAccount(id)
  }

  const handleRemoveAccount = async (id: string, name: string) => {
    if (
      !(await confirm({
        message: `Bạn có chắc muốn xóa tài khoản "${name}"?`,
        isDestructive: true,
      }))
    )
      return
    await removeAccount(id)
  }

  // Open the skin change modal for a specific account
  const openSkinModal = async (accountId: string, accountName: string, accountType: 'local' | 'microsoft') => {
    setSkinModalTargetId(accountId)
    setSkinModalTargetType(accountType)
    setSkinModalTargetName(accountName)
    setNewProfileName(accountName)
    setRenameTargetId(accountId)
    setRenameTargetName(accountName)
    setRenameTargetType(accountType)
    setShowSkinModal(true)
    setMojangProfile(null)

    if (accountType === 'microsoft') {
      setIsFetchingMojang(true)
      try {
        const profile = await window.launcherApi.getMojangProfile(accountId)
        const allowObj = await window.launcherApi.checkMojangNameChange(accountId)
        setMojangProfile(profile)

        // Name change logic for MS
        setRenameAllowed(allowObj?.nameChangeAllowed ?? true)
        if (allowObj?.nameChangeAllowed === false) {
          if (allowObj.createdAt) {
            const createdDate = new Date(allowObj.createdAt)
            const availableDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000)
            const diff = availableDate.getTime() - Date.now()
            if (diff > 0) {
              const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
              setRenameCooldownMessage(`Bạn cần chờ thêm ${days} ngày nữa mới được đổi tên.`)
            } else {
              setRenameCooldownMessage('Chưa thể đổi tên lúc này.')
            }
          } else {
            setRenameCooldownMessage('Bạn không được phép đổi tên tài khoản này.')
          }
        }

        // Find active skin
        const activeSkin = profile.skins?.find((s: any) => s.state === 'ACTIVE')
        if (activeSkin) {
          const base64Skin = await window.launcherApi.fetchMojangTexture(activeSkin.url)
          setPendingSkinFile(base64Skin || activeSkin.url)
          setPendingSkinModel(activeSkin.variant === 'SLIM' ? 'slim' : 'default')
        } else {
          setPendingSkinFile(null)
          setPendingSkinModel('default')
        }

        // Find active cape
        const activeCape = profile.capes?.find((c: any) => c.state === 'ACTIVE')
        if (activeCape) {
          const base64Cape = await window.launcherApi.fetchMojangTexture(activeCape.url)
          setPendingCapeFile(base64Cape || activeCape.url)
          setPendingCapeId(activeCape.id)
          setSelectedCapeUrl(activeCape.url)
        } else {
          setPendingCapeFile(null)
          setSelectedCapeUrl(null)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        showToast('error', `Lỗi tải thông tin Mojang: ${message}`)
        const acc = accountState.accounts.find(a => a.id === accountId)
        setPendingSkinFile(acc?.skinUrl || null)
        setPendingSkinModel((acc?.skinModel as SkinModel) || 'default')
        setPendingCapeFile(acc?.capeUrl || null)
        setSelectedCapeUrl(acc?.capeUrl || null)
      } finally {
        setIsFetchingMojang(false)
      }
    } else {
      setRenameAllowed(true)
      const acc = accountState.accounts.find(a => a.id === accountId)
      setPendingSkinModel((acc?.skinModel as SkinModel) || 'default')
      setPendingSkinFile(acc?.skinUrl || null)
      setPendingCapeFile(acc?.capeUrl || null)
      setSelectedCapeUrl(acc?.capeUrl || null)
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
    setSelectedCapeUrl(null)
    setPendingCapeId('')
    setSkinTab('skin')
    setMojangProfile(null)
    setIsCheckingRename(false)
    setNamemcInput('')
  }

  const handleRenameClick = async () => {
    const trimmed = newProfileName.trim()
    if (!trimmed || trimmed === renameTargetName) {
      setShowSkinModal(false)
      return
    }

    if (renameTargetType === 'local') {
      if (trimmed.length < 3 || trimmed.length > 16) {
        showToast('error', 'Tên local phải từ 3 đến 16 ký tự')
        return
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        showToast('error', 'Tên local chỉ được chứa chữ cái, số và dấu gạch dưới')
        return
      }
    }

    const message = renameTargetType === 'microsoft'
      ? `Bạn có chắc muốn đổi tên tài khoản thành ${trimmed} không?\n\nLưu ý: Sau khi đổi tên, bạn sẽ không thể đổi lại tên khác trong vòng 30 ngày tiếp theo theo luật của Mojang.`
      : `Bạn có chắc muốn đổi tên tài khoản thành ${trimmed} không?`

    if (!(await confirm({ title: 'Xác nhận đổi tên', message }))) return

    setIsSavingRename(true)
    try {
      if (renameTargetType === 'microsoft') {
        try {
        await window.launcherApi.changeMojangName(renameTargetId, trimmed)
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err)
        if (errMessage.includes('TOKEN_EXPIRED') || errMessage.includes('401')) {
          showToast('info', 'Đang tự động gia hạn phiên đăng nhập...')
          await window.launcherApi.refreshMicrosoftAccount(renameTargetId)
          await window.launcherApi.changeMojangName(renameTargetId, trimmed)
        } else if (errMessage.includes('NAME_UNAVAILABLE')) {
            throw new Error('Tên này đã được sử dụng hoặc bạn đang bị giới hạn.')
          } else {
            throw err
          }
        }
      }

      const newState = await window.launcherApi.renameAccountLocally(renameTargetId, trimmed)
      onAccountStateChange(newState)
      showToast('success', 'Đổi tên thành công!')
      setShowSkinModal(false)
    } catch (err) {
      showToast('error', `Lỗi đổi tên: ${(err as Error).message}`)
    } finally {
      setIsSavingRename(false)
    }
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

  const handleSelectGallerySkin = (skinUrl: string, model: 'classic' | 'slim') => {
    setPendingSkinFile(skinUrl)
    setPendingSkinModel(model === 'slim' ? 'slim' : 'default')
  }

  const handleSelectGalleryCape = async (cape: NameMCCape) => {
    setSelectedCapeUrl(cape.url)
    try {
      const base64Cape = await window.launcherApi.fetchMojangTexture(cape.url)
      if (base64Cape) {
        setPendingCapeFile(base64Cape)
      } else {
        setPendingCapeFile(cape.url)
      }
    } catch {
      setPendingCapeFile(cape.url)
    }
  }

  const handleImportNamemc = async () => {
    const raw = namemcInput.trim()
    if (!raw) return

    setIsImportingNamemc(true)
    try {
      // 1. Direct Data URL
      if (raw.startsWith('data:image')) {
        setPendingSkinFile(raw)
        setNamemcInput('')
        return
      }

      // 2. NameMC Skin link / Texture link / Raw 64 hex hash
      const nmcSkinMatch = raw.match(/namemc\.com\/skin\/([a-fA-F0-9]+)/i)
      const nmcTexMatch = raw.match(/namemc\.com\/texture\/([a-fA-F0-9]+)/i)
      const isHexHash = /^[a-fA-F0-9]{64}$/.test(raw)

      if (nmcSkinMatch || nmcTexMatch || isHexHash) {
        const hash = nmcSkinMatch ? nmcSkinMatch[1] : nmcTexMatch ? nmcTexMatch[1] : raw
        const mojangUrl = `https://textures.minecraft.net/texture/${hash}`
        const base64Skin = await window.launcherApi.fetchMojangTexture(mojangUrl)
        if (base64Skin) {
          setPendingSkinFile(base64Skin)
          setNamemcInput('')
          return
        }
      }

      // 3. Direct HTTP Image URL (other than NameMC profile)
      if ((raw.startsWith('http://') || raw.startsWith('https://')) && !raw.includes('namemc.com/profile/')) {
        const base64Skin = await window.launcherApi.fetchMojangTexture(raw)
        if (base64Skin) {
          setPendingSkinFile(base64Skin)
          setNamemcInput('')
          return
        }
      }

      // 4. Player username / NameMC profile lookup
      const playerData = await window.launcherApi.lookupPlayerSkin(raw)
      if (playerData && playerData.url) {
        const base64Skin = await window.launcherApi.fetchMojangTexture(playerData.url)
        if (base64Skin) {
          setPendingSkinFile(base64Skin)
          setPendingSkinModel(playerData.model || 'default')
          if (playerData.capeUrl && skinModalTargetType === 'local') {
            const base64Cape = await window.launcherApi.fetchMojangTexture(playerData.capeUrl)
            if (base64Cape) setPendingCapeFile(base64Cape)
          }
          setNamemcInput('')
          return
        }
      }

      throw new Error('Không tìm thấy skin. Vui lòng kiểm tra lại tên người chơi hoặc link NameMC.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi nạp skin từ NameMC'
      showToast('error', message)
    } finally {
      setIsImportingNamemc(false)
    }
  }

  const handleSkinClick = async () => {
    const message = skinModalTargetType === 'microsoft'
      ? `Bạn có chắc muốn lưu thay đổi ngoại hình cho tài khoản ${skinModalTargetName} không?\n\nLưu ý: Ngoại hình mới sẽ được cập nhật trực tiếp lên hệ thống Mojang và có thể mất một ít thời gian để hiển thị trong game.`
      : `Bạn có chắc muốn lưu thay đổi ngoại hình cho tài khoản ${skinModalTargetName} không?`

    if (!(await confirm({ title: 'Xác nhận lưu thay đổi', message }))) return

    if (!skinModalTargetId) return

    if (skinModalTargetType === 'microsoft') {
      const acc = accountState.accounts.find(a => a.id === skinModalTargetId)
      if (!acc || acc.type !== 'microsoft') return

      setIsSavingMojang(true)
      try {
        let profileChanged = false

        if (pendingSkinFile && pendingSkinFile.startsWith('data:image')) {
          const buffer = dataUrlToArrayBuffer(pendingSkinFile)
          const apiVariant = pendingSkinModel === 'slim' ? 'slim' : 'classic'
          await window.launcherApi.uploadMojangSkin(acc.id, buffer, apiVariant)
          profileChanged = true
        }

        const currentActiveCapeId = mojangProfile?.capes?.find((c: any) => c.state === 'ACTIVE')?.id || ''
        if (pendingCapeId !== currentActiveCapeId) {
          await window.launcherApi.changeMojangCape(acc.id, pendingCapeId)
          profileChanged = true
        }

        if (profileChanged) {
          showToast('success', 'Đã cập nhật Skin/Cape trên Mojang!')
          // Cập nhật lại state account trong launcher để card nhân vật đổi ngay lập tức
          const updatedProfile = await window.launcherApi.getMojangProfile(acc.id)
          const activeSkin = updatedProfile?.skins?.find((s: any) => s.state === 'ACTIVE')
          const activeCape = updatedProfile?.capes?.find((c: any) => c.state === 'ACTIVE')
          const newSkinUrl = activeSkin ? (await window.launcherApi.fetchMojangTexture(activeSkin.url)) || activeSkin.url : null
          const newSkinModel = activeSkin?.variant === 'SLIM' ? 'slim' : 'default'
          const newCapeUrl = activeCape ? (await window.launcherApi.fetchMojangTexture(activeCape.url)) || activeCape.url : null

          const updatedState = await window.launcherApi.saveLocalSkin(acc.id, newSkinUrl, newSkinModel, newCapeUrl)
          onAccountStateChange(updatedState)
        }
        closeSkinModal()
      } catch (err) {
        showToast('error', `Lỗi khi lưu lên Mojang: ${(err as Error).message}`)
      } finally {
        setIsSavingMojang(false)
      }
    } else {
      try {
        const updated = await window.launcherApi.saveLocalSkin(skinModalTargetId, pendingSkinFile, pendingSkinModel, pendingCapeFile)
        onAccountStateChange(updated)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        showToast('error', `Lỗi khi lưu skin local: ${message}`)
      }
      showToast('success', 'Đã cập nhật ngoại hình Local!')
      closeSkinModal()
    }
  }

  const handleCloseAddModal = () => {
    setShowAddModal(false)
  }

  return (
    <div className="px-6 pt-2 pb-6 h-full flex flex-col gap-5">
      <input ref={skinInputRef} type="file" accept="image/png" className="hidden" onChange={handleSkinFileChange} />
      <input ref={capeInputRef} type="file" accept="image/png" className="hidden" onChange={handleCapeFileChange} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground/80">Tài khoản</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý và chuyển đổi giữa các tài khoản của bạn
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} disabled={isWorking} variant="primary" size="sm" className="h-9 px-3">
          <PlusCircle size={14} className="mr-1.5" />
          Thêm tài khoản
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 pt-2">
        {accounts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {accounts.map(acc => {
              const isActive = acc.id === activeAccountId
              const isLocal = acc.type === 'local'
              const skinData = { url: acc.skinUrl || '', model: (acc.skinModel as SkinModel) || 'default' }
              const capeData = acc.capeUrl || ''
              const accModel = (acc.skinModel as SkinModel) || 'default'

              return (
                <div
                  key={acc.id}
                  onClick={() => !isActive && !isWorking && handleSelectAccount(acc.id)}
                  className={[
                    'group relative flex flex-col items-center rounded-md border p-4 transition-all duration-200 cursor-pointer shadow-md',
                    isWorking ? 'opacity-60 cursor-not-allowed' : '',
                    isActive
                      ? 'border-primary/60 bg-zinc-900/90 ring-1 ring-primary/30'
                      : 'border-zinc-800/60 bg-zinc-950/45 hover:bg-zinc-950/70 hover:border-zinc-700/60 hover:-translate-y-0.5',
                  ].join(' ')}
                >
                  {isActive && (
                    <div className="absolute top-0 right-0 flex h-7 w-7 items-center justify-center rounded-bl-md rounded-tr-md bg-primary text-primary-foreground z-10">
                      <Check size={13} strokeWidth={3} />
                    </div>
                  )}

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

                  <div className="relative mt-2 mb-2 group/skin">
                    <SkinViewer3D
                      skinUrl={skinData?.url ? skinData.url : acc.type === 'microsoft' ? `https://mc-heads.net/skin/${acc.username}` : undefined}
                      capeUrl={capeData}
                      model={accModel}
                      width={120} height={130}
                      autoRotate rotateSpeed={0.5}
                    />
                  </div>

                  <div className="text-center w-full min-w-0 px-4">
                    <p className="text-sm font-bold truncate transition-colors text-foreground/85 group-[.border-primary\\/50]:text-primary">
                      {acc.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      UUID: {acc.uuid ? acc.uuid.slice(0, 8) + '...' : 'Unknown'}
                    </p>
                  </div>

                  <div className="flex gap-2 justify-center w-full mt-4 pt-3 border-t border-border/50">
                    <Button size="sm" variant="outline" className="h-7 px-3 hover:bg-primary/10 hover:text-primary hover:border-primary/30" title="Sửa thông tin" onClick={(e) => { e.stopPropagation(); openSkinModal(acc.id, acc.username, acc.type); }}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-destructive hover:bg-destructive/10 hover:border-destructive/30" title="Xóa tài khoản" onClick={(e) => { e.stopPropagation(); handleRemoveAccount(acc.id, acc.username); }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
            <div className="h-16 w-16 rounded-md bg-accent/50 border border-border flex items-center justify-center">
              <UserCircle size={28} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Chưa có tài khoản nào</p>
            <p className="text-xs text-muted-foreground/60">Bấm "Thêm tài khoản" để bắt đầu</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={showSkinModal}
        onClose={closeSkinModal}
        title={`Ngoại hình – ${skinModalTargetName}`}
        description={skinModalTargetType === 'microsoft' ? "Chỉnh sửa Skin & Cape trực tiếp trên server Mojang" : "Chỉnh sửa Skin & Cape (Local)"}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={closeSkinModal} disabled={isSavingMojang || isFetchingMojang}>Hủy</Button>
            <Button variant="primary" onClick={handleSkinClick} disabled={isSavingMojang || isFetchingMojang || (!pendingSkinFile && !pendingCapeFile && skinModalTargetType === 'local')}>
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
            <>
              <div className="flex items-stretch gap-6">
                <div className="shrink-0 rounded-md border border-border bg-accent/20 p-2 flex items-center justify-center w-[160px]">
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

                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex gap-2 bg-muted/30 p-1 rounded-md border border-border">
                    <Button variant={skinTab === 'name' ? 'primary' : 'ghost'} size="sm" className="flex-1" onClick={() => setSkinTab('name')}>Tên</Button>
                    <Button variant={skinTab === 'skin' ? 'primary' : 'ghost'} size="sm" className="flex-1" onClick={() => setSkinTab('skin')}>Skin</Button>
                    <Button variant={skinTab === 'cape' ? 'primary' : 'ghost'} size="sm" className="flex-1" onClick={() => setSkinTab('cape')}>Cape</Button>
                  </div>

                  {skinTab === 'name' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {isCheckingRename ? (
                        <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <Input
                              value={newProfileName}
                              onChange={e => setNewProfileName(e.target.value)}
                              placeholder="Nhập tên mới"
                              maxLength={16}
                              disabled={!renameAllowed || isSavingRename}
                            />
                          </div>
                          {!renameAllowed && renameTargetType === 'microsoft' && (
                            <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-md text-xs">
                              {renameCooldownMessage || 'Tài khoản Premium này chưa được phép đổi tên.'}
                            </div>
                          )}
                          <Button onClick={handleRenameClick} className="w-full mt-2" disabled={isSavingRename || !renameAllowed || newProfileName.trim() === '' || newProfileName.trim() === renameTargetName}>
                            {isSavingRename ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            Lưu thay đổi tên
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {skinTab === 'skin' && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-foreground">Skin (Giao diện)</label>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => skinInputRef.current?.click()}>
                          <Upload size={12} className="mr-1.5 text-muted-foreground" /> Chọn file mới
                        </Button>
                      </div>

                      <div className="flex items-center gap-3">
                        {pendingSkinFile ? (
                          <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-md border border-primary/40 bg-black/10">
                            <span className="text-xs font-medium text-primary">Đã nạp file skin</span>
                            <button type="button" className="text-xs font-medium text-red-900 hover:text-destructive/80 transition-colors flex items-center justify-center p-1 rounded-full hover:bg-destructive/10" onClick={() => setPendingSkinFile(null)} title="Gỡ bỏ">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Chưa nạp skin mới. Bạn có thể chọn file hoặc dùng link ảnh/NameMC để nạp.</p>
                        )}
                      </div>

                      {/* Arm type selector */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPendingSkinModel('default')}
                          className={['flex items-center gap-3 p-3 rounded-md border-2 transition-all duration-200 shadow-sm', pendingSkinModel === 'default' ? 'border-primary bg-primary/15' : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'].join(' ')}
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
                          className={['flex items-center gap-3 p-3 rounded-md border-2 transition-all duration-200 shadow-sm', pendingSkinModel === 'slim' ? 'border-primary bg-primary/15' : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'].join(' ')}
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

                      {/* NameMC Smart Import */}
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Tên người chơi (SlenderMan, Độ Mixi...) hoặc link NameMC..."
                            className="h-8 text-xs flex-1"
                            value={namemcInput}
                            onChange={(e) => setNamemcInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleImportNamemc()
                            }}
                            disabled={isImportingNamemc}
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs shrink-0 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                            onClick={handleImportNamemc}
                            disabled={isImportingNamemc || !namemcInput.trim()}
                          >
                            {isImportingNamemc ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={13} className="mr-1" />}
                            Nạp
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Cape Section */}
                  {skinTab === 'cape' && (
                    <div className="space-y-3 animate-in fade-in duration-200">
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
                            <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-md border border-primary/40 bg-black/10">
                              <span className="text-xs font-medium text-primary">Đã nạp file áo choàng</span>
                              <button type="button" className="text-xs font-medium text-red-900 hover:text-destructive/80 transition-colors flex items-center justify-center p-1 rounded-full hover:bg-destructive/10" onClick={() => { setPendingCapeFile(null); setSelectedCapeUrl(null); }} title="Gỡ bỏ">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Chưa có áo choàng. Bạn có thể chọn từ danh sách NameMC bên dưới hoặc tự tải lên file PNG.</p>
                          )}
                        </div>
                      ) : (
                        // Microsoft Capes
                        <div className="space-y-3">
                          <div className="p-2.5 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary flex items-start gap-2">
                            <Sparkles size={14} className="shrink-0 mt-0.5" />
                            <span>Tài khoản Microsoft (Bản quyền) chỉ có thể trang bị các áo choàng chính chủ được cấp phép trên hệ thống Mojang.</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                            <button
                              type="button"
                              onClick={() => { setPendingCapeId(''); setPendingCapeFile(null); setSelectedCapeUrl(null); }}
                              className={['flex items-center gap-2 p-2.5 rounded-md border transition-all shadow-sm', pendingCapeId === '' ? 'border-primary bg-primary/15' : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'].join(' ')}
                            >
                              <div className="h-8 w-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                                <XCircle size={14} className="text-muted-foreground" />
                              </div>
                              <span className={['text-xs font-medium text-left truncate', pendingCapeId === '' ? 'text-primary' : 'text-foreground'].join(' ')}>Không dùng áo choàng</span>
                            </button>

                            {mojangProfile?.capes?.map((cape: any) => (
                              <button
                                key={cape.id}
                                type="button"
                                onClick={() => { setPendingCapeId(cape.id); setPendingCapeFile(cape.url); setSelectedCapeUrl(cape.url); }}
                                className={['flex items-center gap-3 p-2.5 rounded-md border transition-all shadow-sm', pendingCapeId === cape.id ? 'border-primary bg-primary/15 ring-1 ring-primary/40' : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'].join(' ')}
                              >
                                <CapePreview capeUrl={cape.url} width={20} height={32} className="shrink-0 drop-shadow-md" />
                                <span className={['text-xs font-bold text-left truncate', pendingCapeId === cape.id ? 'text-primary' : 'text-foreground'].join(' ')}>
                                  {cape.alias || 'Cape Mojang'}
                                </span>
                              </button>
                            ))}
                            {mojangProfile?.capes?.length === 0 && (
                              <div className="col-span-2 p-3 text-center rounded-md border border-dashed border-border">
                                <span className="text-xs text-muted-foreground">Tài khoản này không sở hữu áo choàng nào trên Mojang.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* NameMC Skin Gallery Section */}
              {skinTab === 'skin' && (
                <Suspense
                  fallback={
                    <div className="flex justify-center py-10">
                      <Loader2 size={24} className="animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <NameMCSkinGallery
                    pendingSkinFile={pendingSkinFile}
                    onSelectSkin={handleSelectGallerySkin}
                    showToast={showToast}
                    isTargetLocal={skinModalTargetType === 'local'}
                    onDirectPlayerLoaded={(skinBase64, model, capeBase64) => {
                      setPendingSkinFile(skinBase64)
                      setPendingSkinModel(model === 'slim' ? 'slim' : 'default')
                      if (capeBase64) setPendingCapeFile(capeBase64)
                    }}
                  />
                </Suspense>
              )}

              {/* NameMC & Mojang Capes Gallery Section (Local only) */}
              {skinTab === 'cape' && skinModalTargetType === 'local' && (
                <Suspense
                  fallback={
                    <div className="flex justify-center py-10">
                      <Loader2 size={24} className="animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <NameMCCapeGallery
                    pendingCapeFile={pendingCapeFile}
                    selectedCapeUrl={selectedCapeUrl}
                    onSelectCape={handleSelectGalleryCape}
                  />
                </Suspense>
              )}

            </>
          )}
        </div>
      </Modal>

      {/* ── Add Account Modal ── */}
      <AddAccountModal
        isOpen={showAddModal}
        onClose={handleCloseAddModal}
        isWorking={isWorking}
        onMicrosoftLogin={handleMicrosoftLogin}
        onAddLocalAccount={handleAddLocalAccount}
      />
    </div>
  )
}
