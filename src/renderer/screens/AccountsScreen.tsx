import { useState, useRef, useEffect } from 'react'
import type { AccountState } from '@/shared/types.ts'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
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
  UserCircle,
  Loader2,
  XCircle,
  Pencil
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

import { SkinBody } from '../components/ui/SkinBody'

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

const GallerySkinItem = ({ skin, onSelect }: { skin: any, onSelect: () => void }) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="bg-transparent border border-transparent rounded-xl p-2 flex flex-col items-center gap-2 hover:border-primary/30 hover:bg-card/50 transition-all group"
      title={skin.name || 'Skin'}
    >
      <div className="w-16 h-24 rounded-sm overflow-hidden flex items-center justify-center bg-zinc-900/10 group-hover:scale-105 transition-transform drop-shadow-sm">
        <SkinBody skinUrl={skin.url} width={48} height={96} className="h-full object-contain" />
      </div>
    </button>
  )
}

export const AccountsScreen = ({
  accountState,
  onAccountStateChange,
  appendLog,
  isWorking,
}: AccountsScreenProps) => {
  const { showToast } = useToast()
  const confirm = useConfirm()
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
  const [skinTab, setSkinTab] = useState<'name' | 'skin' | 'cape'>('skin')

  const [mineskinInput, setMineskinInput] = useState('')
  const [isFetchingMineskin, setIsFetchingMineskin] = useState(false)

  const [mineskinGallery, setMineskinGallery] = useState<any[]>([])
  const [isFetchingGallery, setIsFetchingGallery] = useState(false)
  const [galleryPage, setGalleryPage] = useState(1)
  const [galleryQuery, setGalleryQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')

  const [renameAllowed, setRenameAllowed] = useState(true)
  const [renameCooldownMessage, setRenameCooldownMessage] = useState('')
  const [isCheckingRename, setIsCheckingRename] = useState(false)
  const [isSavingRename, setIsSavingRename] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [renameTargetId, setRenameTargetId] = useState('')
  const [renameTargetName, setRenameTargetName] = useState('')
  const [renameTargetType, setRenameTargetType] = useState<'local' | 'microsoft'>('local')
  const [renameTargetToken, setRenameTargetToken] = useState('')

  const [mineskinCapes, setMineskinCapes] = useState<any[]>([])
  const [isFetchingCapes, setIsFetchingCapes] = useState(false)
  const [capeGalleryQuery, setCapeGalleryQuery] = useState('')

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
    if (!(await confirm({ message: `Bạn có chắc muốn xóa tài khoản "${name}"?`, isDestructive: true }))) return
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
    setNewProfileName(accountName)
    setRenameTargetId(accountId)
    setRenameTargetName(accountName)
    setRenameTargetType(accountType)
    setRenameTargetToken(accessToken || '')
    setShowSkinModal(true)
    setMojangProfile(null)

    if (accountType === 'microsoft' && accessToken) {
      setIsFetchingMojang(true)
      try {
        const profile = await window.launcherApi.getMojangProfile(accessToken)
        const allowObj = await window.launcherApi.checkMojangNameChange(accessToken)
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
          setCapeMap(prev => ({ ...prev, [accountId]: base64Cape || activeCape.url }))
        } else {
          setPendingCapeId('')
          setPendingCapeFile(null)
          setCapeMap(prev => { const nm = { ...prev }; delete nm[accountId]; return nm })
        }
      } catch (err) {
        showToast('error', 'Không thể lấy thông tin từ Mojang.')
        setPendingSkinFile(skinMap[accountId]?.url || null)
        setPendingSkinModel(modelMap[accountId] || 'default')
        setPendingCapeFile(capeMap[accountId] || null)
      } finally {
        setIsFetchingMojang(false)
      }
    } else {
      setRenameAllowed(true)
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
    setSkinTab('skin')
    setMojangProfile(null)
    setIsCheckingRename(false)
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
          await window.launcherApi.changeMojangName(renameTargetToken, trimmed)
        } catch (err: any) {
          if (err.message?.includes('TOKEN_EXPIRED') || err.message?.includes('401')) {
            showToast('info', 'Đang tự động gia hạn phiên đăng nhập...')
            const newState = await window.launcherApi.refreshMicrosoftAccount(renameTargetId)
            const newAcc = newState.accounts.find((a: any) => a.id === renameTargetId)
            if (newAcc?.accessToken) {
              await window.launcherApi.changeMojangName(newAcc.accessToken, trimmed)
            } else {
              throw new Error('Gia hạn thất bại.')
            }
          } else if (err.message?.includes('NAME_UNAVAILABLE')) {
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

  const loadMineskinGallery = async (page: number, query: string = activeQuery) => {
    setIsFetchingGallery(true)
    try {
      const url = query.trim()
        ? `https://api.mineskin.org/get/list/${page}?filter=${encodeURIComponent(query)}`
        : `https://api.mineskin.org/get/list/${page}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setMineskinGallery(data.skins || [])
        setGalleryPage(page)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsFetchingGallery(false)
    }
  }

  const loadMineskinCapes = async () => {
    setIsFetchingCapes(true)
    try {
      const res = await fetch('https://api.mineskin.org/v2/capes')
      if (res.ok) {
        const data = await res.json()
        setMineskinCapes(data.capes || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsFetchingCapes(false)
    }
  }

  useEffect(() => {
    if (showSkinModal && skinModalTargetType === 'local' && skinTab === 'cape' && mineskinCapes.length === 0) {
      loadMineskinCapes()
    }
  }, [showSkinModal, skinModalTargetType, skinTab])

  const handleSearchGallery = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveQuery(galleryQuery)
    loadMineskinGallery(1, galleryQuery)
  }

  useEffect(() => {
    if (showSkinModal && skinTab === 'skin' && mineskinGallery.length === 0) {
      loadMineskinGallery(1)
    }
  }, [showSkinModal, skinTab])

  const handleSelectGalleryCape = async (url: string) => {
    setIsFetchingCapes(true)
    try {
      const base64Cape = await window.launcherApi.fetchMojangTexture(url)
      if (base64Cape) {
        setPendingCapeFile(base64Cape)
      } else {
        throw new Error('Không thể tải ảnh cape')
      }
    } catch (err) {
      showToast('error', 'Lỗi tải ảnh cape từ MineSkin')
    } finally {
      setIsFetchingCapes(false)
    }
  }

  const handleSelectGallerySkin = async (textureUrl: string) => {
    setIsFetchingMineskin(true)
    try {
      const base64Skin = await window.launcherApi.fetchMojangTexture(textureUrl)
      if (base64Skin) {
        setPendingSkinFile(base64Skin)
        setPendingSkinModel('default')
      } else {
        throw new Error('Không thể tải ảnh')
      }
    } catch (err) {
      showToast('error', 'Lỗi tải ảnh từ thư viện MineSkin')
    } finally {
      setIsFetchingMineskin(false)
    }
  }

  const handleImportMineskin = async () => {
    if (!mineskinInput.trim()) return
    const identifier = mineskinInput.trim()

    setIsFetchingMineskin(true)
    try {
      let textureUrl = ''
      let variant = 'default'

      if (identifier.startsWith('http') && !identifier.includes('mineskin.org/')) {
        textureUrl = identifier
      } else {
        let msId = identifier
        if (identifier.includes('mineskin.org/')) {
          const parts = identifier.split('/').filter(Boolean)
          msId = parts[parts.length - 1]
        }

        const isId = /^\d+$/.test(msId)
        const url = isId
          ? `https://api.mineskin.org/get/id/${msId}`
          : `https://api.mineskin.org/get/uuid/${msId}`

        const res = await fetch(url)
        if (!res.ok) throw new Error('Không tìm thấy skin (hoặc MineSkin lỗi)')
        const data = await res.json()

        textureUrl = data?.data?.texture?.url
        variant = data?.variant || 'classic'
      }

      if (textureUrl) {
        const base64Skin = await window.launcherApi.fetchMojangTexture(textureUrl)
        if (base64Skin) {
          setPendingSkinFile(base64Skin)
          setPendingSkinModel(variant === 'slim' ? 'slim' : 'default')
        } else {
          throw new Error('Không thể tải ảnh từ link này')
        }
      } else {
        throw new Error('Dữ liệu skin không hợp lệ')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi tải ảnh skin')
    } finally {
      setIsFetchingMineskin(false)
      setMineskinInput('')
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
      if (!acc || acc.type !== 'microsoft' || !acc.accessToken) return

      setIsSavingMojang(true)
      try {
        let profileChanged = false

        if (pendingSkinFile && pendingSkinFile.startsWith('data:image')) {
          const buffer = dataUrlToArrayBuffer(pendingSkinFile)
          const apiVariant = pendingSkinModel === 'slim' ? 'slim' : 'classic'
          await window.launcherApi.uploadMojangSkin(acc.accessToken, buffer, apiVariant)
          profileChanged = true
        }

        const currentActiveCapeId = mojangProfile?.capes?.find((c: any) => c.state === 'ACTIVE')?.id || ''
        if (pendingCapeId !== currentActiveCapeId) {
          await window.launcherApi.changeMojangCape(acc.accessToken, pendingCapeId)
          profileChanged = true
        }

        if (profileChanged) {
          showToast('success', 'Đã cập nhật Skin/Cape trên Mojang!')
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
            setCapeMap(prev => { const nm = { ...prev }; delete nm[skinModalTargetId]; return nm })
          }
        }
        closeSkinModal()
      } catch (err) {
        showToast('error', `Lỗi khi lưu lên Mojang: ${(err as Error).message}`)
      } finally {
        setIsSavingMojang(false)
      }
    } else {
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
        setCapeMap(prev => { const nm = { ...prev }; delete nm[skinModalTargetId]; return nm })
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
                    'group relative flex flex-col items-center rounded-2xl border p-4 transition-all duration-200 cursor-pointer bg-card',
                    isWorking ? 'opacity-60 cursor-not-allowed' : '',
                    isActive
                      ? 'border-primary/50'
                      : 'border-border hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5',
                  ].join(' ')}
                >
                  {isActive && (
                    <div className="absolute top-0 right-0 flex h-7 w-7 items-center justify-center rounded-bl-xl rounded-tr-[15px] bg-primary text-primary-foreground z-10">
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

                  <div className="relative mt-2 mb-2 group/skin cursor-pointer" onClick={(e) => { e.stopPropagation(); openSkinModal(acc.id, acc.username, acc.type, (acc as any).accessToken); }}>
                    <SkinViewer3D
                      skinUrl={skinData?.url ? skinData.url : acc.type === 'microsoft' ? `https://mc-heads.net/skin/${acc.username}` : undefined}
                      capeUrl={capeData}
                      model={accModel}
                      width={120} height={130}
                      autoRotate rotateSpeed={0.5}
                    />
                  </div>

                  <div className="text-center w-full min-w-0 px-4">
                    <p className="text-sm font-bold truncate transition-colors text-foreground group-[.border-primary\\/50]:text-primary">
                      {acc.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      UUID: {acc.uuid ? acc.uuid.slice(0, 8) + '...' : 'Unknown'}
                    </p>
                  </div>

                  <div className="flex gap-2 justify-center w-full mt-4 pt-3 border-t border-border/50">
                    <Button size="sm" variant="outline" className="h-7 px-3 hover:bg-primary/10 hover:text-primary hover:border-primary/30" title="Sửa thông tin" onClick={(e) => { e.stopPropagation(); openSkinModal(acc.id, acc.username, acc.type, (acc as any).accessToken); }}>
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
            <div className="h-16 w-16 rounded-2xl bg-accent/50 border border-border flex items-center justify-center">
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
        maxWidth="max-w-xl"
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

                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex gap-2 bg-muted/30 p-1 rounded-xl border border-border">
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
                              <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-lg text-xs">
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
                          <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/40 bg-black/10">
                            <span className="text-xs font-medium text-primary">Đã nạp file skin</span>
                            <button type="button" className="text-xs font-medium text-red-900 hover:text-destructive/80 transition-colors flex items-center justify-center p-1 rounded-full hover:bg-destructive/10" onClick={() => setPendingSkinFile(null)} title="Gỡ bỏ">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Chưa nạp skin mới. Bạn có thể chọn file hoặc dùng link ảnh để nạp.</p>
                        )}
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

                      {/* MineSkin Import */}
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          placeholder="Link ảnh .png bất kỳ hoặc MineSkin ID..."
                          className="h-8 text-xs flex-1"
                          value={mineskinInput}
                          onChange={(e) => setMineskinInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleImportMineskin()
                          }}
                          disabled={isFetchingMineskin}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          onClick={handleImportMineskin}
                          disabled={isFetchingMineskin || !mineskinInput.trim()}
                        >
                          {isFetchingMineskin ? <Loader2 size={14} className="animate-spin" /> : 'Import'}
                        </Button>
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
                            <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/40 bg-black/10">
                              <span className="text-xs font-medium text-primary">Đã nạp file áo choàng</span>
                              <button type="button" className="text-xs font-medium text-red-900 hover:text-destructive/80 transition-colors flex items-center justify-center p-1 rounded-full hover:bg-destructive/10" onClick={() => setPendingCapeFile(null)} title="Gỡ bỏ">
                                <Trash2 size={16} />
                              </button>
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
                  )}
                </div>
              </div>

              {/* MineSkin Gallery Independent Section */}
              {skinTab === 'skin' && (
                <div className="pt-5 border-t border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-foreground">Skin (MineSkin)</label>

                    <div className="flex items-center gap-4">
                      <form onSubmit={handleSearchGallery} className="flex items-center gap-2">
                        <Input
                          placeholder="Tìm kiếm skin..."
                          className="h-8 text-xs w-48"
                          value={galleryQuery}
                          onChange={(e) => setGalleryQuery(e.target.value)}
                        />
                        <Button type="submit" variant="secondary" size="sm" className="h-8 text-xs">
                          Tìm
                        </Button>
                      </form>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs px-2" disabled={galleryPage <= 1 || isFetchingGallery} onClick={() => loadMineskinGallery(galleryPage - 1)}>
                          Trước
                        </Button>
                        <span className="text-sm font-medium text-muted-foreground flex items-center min-w-[50px] justify-center">Trang {galleryPage}</span>
                        <Button variant="outline" size="sm" className="h-8 text-xs px-2" disabled={isFetchingGallery || mineskinGallery.length === 0} onClick={() => loadMineskinGallery(galleryPage + 1)}>
                          Tiếp
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-1">
                    {isFetchingGallery ? (
                      <div className="col-span-4 flex justify-center py-10">
                        <Loader2 size={24} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : mineskinGallery.length === 0 ? (
                      <div className="col-span-4 text-center text-sm text-muted-foreground py-8">
                        Không tìm thấy skin nào.
                      </div>
                    ) : (
                      mineskinGallery.map((skin) => (
                        <GallerySkinItem key={skin.id} skin={skin} onSelect={() => handleSelectGallerySkin(skin.url)} />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* MineSkin Cape Gallery Independent Section */}
              {skinTab === 'cape' && skinModalTargetType === 'local' && (
                <div className="pt-5 border-t border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-foreground">Cape (MineSkin)</label>

                    <div className="flex items-center gap-4">
                      <Input
                        placeholder="Tìm kiếm cape..."
                        className="h-8 text-xs w-48"
                        value={capeGalleryQuery}
                        onChange={(e) => setCapeGalleryQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-1">
                    {isFetchingCapes ? (
                      <div className="col-span-4 flex justify-center py-10">
                        <Loader2 size={24} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : mineskinCapes.length === 0 ? (
                      <div className="col-span-4 text-center text-sm text-muted-foreground py-8">
                        Không tìm thấy cape nào.
                      </div>
                    ) : (
                      mineskinCapes
                        .filter(cape => !capeGalleryQuery || cape.alias?.toLowerCase().includes(capeGalleryQuery.toLowerCase()))
                        .map((cape) => (
                          <button
                            key={cape.uuid}
                            type="button"
                            onClick={() => handleSelectGalleryCape(cape.url)}
                            className="bg-transparent border border-transparent rounded-xl p-2 flex flex-col items-center gap-2 hover:border-primary/30 hover:bg-card/50 transition-all group"
                            title={cape.alias || 'Cape'}
                          >
                            <div className="w-16 h-24 rounded-sm overflow-hidden flex items-center justify-center bg-zinc-900/10 group-hover:scale-105 transition-transform drop-shadow-sm">
                              <CapePreview capeUrl={cape.url} width={40} height={64} className="shrink-0 drop-shadow-md" />
                            </div>
                            <span className="text-xs font-medium text-foreground truncate w-full text-center">{cape.alias}</span>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}
            </>
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
              <p className="text-sm font-bold text-foreground/80">Tài khoản Microsoft</p>
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
                <p className="text-sm font-bold text-foreground/80">Tài khoản Local (Offline)</p>
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
                <span className="text-sm font-bold text-foreground/80">Tạo tài khoản Local</span>
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
