import { useState } from 'react'
import type { AccountState } from '@/shared/types.ts'
import { Input } from '../components/ui/Input'
import { Key, FlaskConical, Trash2, PlusCircle, Check } from 'lucide-react'
import { Button } from '../components/ui/button'

interface AccountsScreenProps {
  accountState: AccountState
  onAccountStateChange: (state: AccountState) => void
  appendLog: (level: 'info' | 'success' | 'warn' | 'error', message: string) => void
  isWorking?: boolean
}

export const AccountsScreen = ({
  accountState,
  onAccountStateChange,
  appendLog,
  isWorking,
}: AccountsScreenProps) => {
  const [newLocalUsername, setNewLocalUsername] = useState('')

  const handleMicrosoftLogin = async () => {
    try {
      const account = await window.launcherApi.loginMicrosoft()
      const updated = await window.launcherApi.saveMicrosoftAccount(account)
      onAccountStateChange(updated)
      appendLog('success', `Đã đăng nhập tài khoản Microsoft: ${account.username}`)
    } catch (e) {
      appendLog('error', e instanceof Error ? e.message : 'Lỗi đăng nhập')
      alert(e instanceof Error ? e.message : 'Lỗi đăng nhập')
    }
  }

  const handleAddLocalAccount = async () => {
    if (!newLocalUsername || newLocalUsername.trim().length === 0) {
      alert('Vui lòng nhập tên tài khoản.')
      return
    }
    try {
      const updated = await window.launcherApi.addLocalAccount(newLocalUsername)
      onAccountStateChange(updated)
      setNewLocalUsername('')
      appendLog('success', `Đã tạo tài khoản Local mới: ${newLocalUsername}`)
    } catch (e) {
      appendLog('error', e instanceof Error ? e.message : 'Lỗi tạo tài khoản')
      alert(e instanceof Error ? e.message : 'Lỗi tạo tài khoản')
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

  return (
    <div className="px-6 pt-2 pb-6 max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Tài khoản</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Quản lý và chuyển đổi giữa các tài khoản của bạn</p>
      </div>

      {/* Account List */}
      <div className="space-y-2">
        {(accountState?.accounts || []).map(acc => {
          const isActive = acc.id === accountState?.activeAccountId
          const isLocal = acc.type === 'local'
          return (
            <div
              key={acc.id}
              onClick={() => !isActive && handleSelectAccount(acc.id)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isActive
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:bg-accent/40'
                }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground'
                  }`}>
                  {isLocal ? <FlaskConical className="h-4 w-4" /> : <Key className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">{acc.username}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${isLocal
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                      {isLocal ? 'Local' : 'Microsoft'}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    UUID: {acc.uuid.slice(0, 8)}...
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                {isActive && (
                  <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                    <Check className="h-3 w-3" /> Đang chọn
                  </span>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                  title="Xóa tài khoản"
                  onClick={() => handleRemoveAccount(acc.id, acc.username)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Account Actions */}
      <div className="border-t border-border pt-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Thêm tài khoản mới</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Add Local Account */}
          <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-accent/10">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Tài khoản Local (Offline)</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  disabled={isWorking}
                  value={newLocalUsername}
                  onChange={(e) => setNewLocalUsername(e.target.value)}
                  placeholder="Tên người chơi..."
                  className="h-9"
                />
              </div>
              <Button
                onClick={handleAddLocalAccount}
                disabled={isWorking}
                variant="outline"
                className="h-9"
              >
                Thêm
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Khởi tạo nhanh, không cần đăng nhập Internet.</p>
          </div>

          {/* Add Microsoft Account */}
          <div className="flex flex-col justify-between p-4 rounded-xl border border-border/60 bg-accent/10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Tài khoản Microsoft (Online)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">Đăng nhập tài khoản bản quyền Microsoft để vào máy chủ Online.</p>
            </div>
            <Button
              onClick={handleMicrosoftLogin}
              disabled={isWorking}
              variant="primary"
              className="w-full h-9"
            >
              <PlusCircle className="h-4 w-4 mr-1.5" /> Đăng nhập Microsoft
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
