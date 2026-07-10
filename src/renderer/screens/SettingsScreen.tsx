import { useState, useEffect } from 'react'
import type {
  LauncherSettings,
  LauncherProfile,
  AccountState,
  SystemPerformanceInfo,
  AutoPerformanceRecommendation,
} from '@/shared/types.ts'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { CheckCircle2, AlertTriangle, Save, Key, ShieldAlert, Sparkles, FlaskConical, Cpu } from 'lucide-react'
import { Button } from '../components/ui/button'

interface SettingsScreenProps {
  settings: LauncherSettings
  activeProfile: LauncherProfile | null
  onSave: (settings: LauncherSettings) => void
  accountState: AccountState
  gameDir: string
  onAccountStateChange: (state: AccountState) => void
  appendLog: (level: 'info' | 'success' | 'warn' | 'error', message: string) => void
  isWorking?: boolean
}

export const SettingsScreen = ({
  settings,
  activeProfile,
  onSave,
  accountState,
  gameDir,
  onAccountStateChange,
  appendLog,
  isWorking,
}: SettingsScreenProps) => {
  const [formData, setFormData] = useState<LauncherSettings>({
    ...settings,
    performanceMode: settings.performanceMode ?? 'auto',
  })
  const [javaSelection, setJavaSelection] = useState<any>(null)
  const [saved, setSaved] = useState(false)
  const [localUsername, setLocalUsername] = useState(accountState.localAccount.username)
  const [sysInfo, setSysInfo] = useState<SystemPerformanceInfo | null>(null)
  const [recommendation, setRecommendation] = useState<AutoPerformanceRecommendation | null>(null)

  const isAuto = (formData.performanceMode ?? 'auto') === 'auto'

  useEffect(() => {
    setLocalUsername(accountState.localAccount.username)
  }, [accountState.localAccount.username])

  useEffect(() => {
    async function loadPerf() {
      if (!window.launcherApi?.getSystemPerformanceInfo) return
      try {
        const info = await window.launcherApi.getSystemPerformanceInfo()
        setSysInfo(info)
        const eff = await window.launcherApi.getEffectivePerformanceSettings()
        setRecommendation(eff.recommendation)
      } catch {
        /* ignore */
      }
    }
    void loadPerf()
  }, [gameDir])

  useEffect(() => {
    async function checkJava() {
      if (window.launcherApi && activeProfile) {
        const res = await window.launcherApi.selectBestJavaRuntime(
          activeProfile.minecraftVersion,
          formData.customJavaScanDirs
        )
        setJavaSelection(res)
      }
    }
    void checkJava()
  }, [activeProfile?.minecraftVersion, formData.customJavaScanDirs])

  const handleChange = (key: keyof LauncherSettings, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave(formData)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleMicrosoftLogin = async () => {
    try {
      const account = await window.launcherApi.loginMicrosoft()
      const updated = await window.launcherApi.saveMicrosoftAccount(account)
      onAccountStateChange(updated)
      const switched = await window.launcherApi.setAccountMode('microsoft')
      onAccountStateChange(switched)
      appendLog('success', `Đã đăng nhập và kích hoạt tài khoản Microsoft: ${account.username}`)
    } catch (e) {
      appendLog('error', e instanceof Error ? e.message : 'Lỗi đăng nhập')
      alert(e instanceof Error ? e.message : 'Lỗi đăng nhập')
    }
  }

  const handleMicrosoftLogout = async () => {
    if (!confirm('Bạn có chắc muốn đăng xuất tài khoản Microsoft? Hệ thống sẽ tự động chuyển về chế độ Local Test.')) return
    try {
      const updated = await window.launcherApi.logoutMicrosoftAccount()
      onAccountStateChange(updated)
      appendLog('info', 'Đã đăng xuất tài khoản Microsoft.')
    } catch (e) {
      appendLog('error', e instanceof Error ? e.message : 'Lỗi đăng xuất')
    }
  }

  const handleSaveLocalUsername = async () => {
    try {
      const updated = await window.launcherApi.updateLocalAccount(localUsername)
      onAccountStateChange(updated)
      appendLog('success', `Đã lưu tên local thành công: ${localUsername}`)
    } catch (e) {
      appendLog('error', e instanceof Error ? e.message : 'Không thể lưu tên local')
      alert(e instanceof Error ? e.message : 'Không thể lưu tên local')
    }
  }

  const handleSetMode = async (mode: 'microsoft' | 'local') => {
    try {
      const updated = await window.launcherApi.setAccountMode(mode)
      onAccountStateChange(updated)
      appendLog('success', `Chuyển chế độ hoạt động sang: ${mode === 'microsoft' ? 'Microsoft' : 'Local Test'}`)
    } catch (e) {
      appendLog('error', e instanceof Error ? e.message : 'Không thể chuyển chế độ')
    }
  }

  const isModeMicrosoft = accountState.mode === 'microsoft'
  const isModeLocal = accountState.mode === 'local'

  return (
    <div className="px-6 pt-2 pb-6 max-w-4xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Cài đặt</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Thiết lập các cấu hình launcher</p>
        </div>
        <Button onClick={handleSave} disabled={isWorking} variant="primary">
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Đã lưu
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Lưu cài đặt
            </>
          )}
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Tài khoản & Chế độ chơi</h3>

        <Card>
          <CardHeader>
            <CardTitle>Chế độ tài khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <button
                disabled={isWorking}
                onClick={() => handleSetMode('microsoft')}
                className={`flex-1 h-12 rounded-xl border text-sm font-medium transition-all ${
                  isModeMicrosoft
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent/50'
                } ${isWorking ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Microsoft (Online)
              </button>
              <button
                disabled={isWorking}
                onClick={() => handleSetMode('local')}
                className={`flex-1 h-12 rounded-xl border text-sm font-medium transition-all ${
                  isModeLocal
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent/50'
                } ${isWorking ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Local Test (Offline)
              </button>
            </div>
          </CardContent>
        </Card>

        {isModeMicrosoft && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" /> Tài khoản Microsoft
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accountState.microsoftAccount ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{accountState.microsoftAccount.username}</p>
                    <p className="text-xs text-muted-foreground">Đã đăng nhập • UUID: {accountState.microsoftAccount.uuid.slice(0, 8)}…</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={isWorking} onClick={handleMicrosoftLogout}>
                    Đăng xuất
                  </Button>
                </div>
              ) : (
                <Button onClick={handleMicrosoftLogin} disabled={isWorking} variant="primary" className="w-full">
                  Đăng nhập Microsoft
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {isModeLocal && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Local Test Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  label="Tên người chơi"
                  disabled={isWorking}
                  value={localUsername}
                  onChange={(e) => setLocalUsername(e.target.value)}
                  placeholder="Player"
                />
                <Button onClick={handleSaveLocalUsername} disabled={isWorking} variant="outline" className="mt-6">
                  Lưu
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Chế độ test offline — không cần đăng nhập.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Java Runtime</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border">
                <span className="text-muted-foreground">Phiên bản yêu cầu</span>
                <span className="font-semibold text-foreground">
                  {javaSelection ? `Java ${javaSelection.requiredVersion}` : 'Chưa xác định'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border">
                <span className="text-muted-foreground">Phiên bản đã chọn</span>
                <span className="font-semibold text-foreground">
                  {javaSelection?.selectedRuntime
                    ? `Java ${javaSelection.selectedRuntime.majorVersion}`
                    : 'Không có'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border">
                <span className="text-muted-foreground">Chế độ</span>
                <span className="font-medium text-foreground">
                  {javaSelection?.found
                    ? javaSelection.isExactMatch
                      ? 'Trùng khớp hoàn toàn'
                      : 'Dùng bản mới nhất'
                    : 'Không tương thích'}
                </span>
              </div>
            </div>

            {javaSelection?.warning && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{javaSelection.warning}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            Tối ưu hiệu năng
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/40 border border-border">
            <button
              type="button"
              onClick={() => handleChange('performanceMode', 'auto')}
              className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                isAuto ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tự động (Khuyên dùng)
            </button>
            <button
              type="button"
              onClick={() => handleChange('performanceMode', 'manual')}
              className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                !isAuto ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Nâng cao (Thủ công)
            </button>
          </div>

          {sysInfo && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-accent/20 p-3.5">
              <Cpu className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-foreground">
                  Máy: {sysInfo.totalRamGb}GB RAM · {sysInfo.cpuCores} cores
                  {sysInfo.isLowEnd ? ' · Yếu' : sysInfo.isHighEnd ? ' · Mạnh' : ' · Trung bình'}
                </p>
                {recommendation && <p className="text-muted-foreground">{recommendation.reason}</p>}
              </div>
            </div>
          )}

          {isAuto && recommendation && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-sm">
              <p className="font-semibold text-foreground">Cấu hình đang áp dụng (tự động)</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>RAM mặc định: {recommendation.recommendedMinRam}–{recommendation.recommendedMaxRam} MB</li>
                <li>Download concurrency: {recommendation.recommendedConcurrency} luồng</li>
                <li>
                  Launch Boost: {recommendation.recommendedBoostPriority} ·{' '}
                  {Math.round(recommendation.recommendedBoostDurationMs / 1000)}s
                </li>
                <li>Auto Prepare: {sysInfo?.isLowEnd ? 'tắt (máy yếu)' : 'bật'}</li>
              </ul>
              <p className="text-[11px] text-muted-foreground/80 pt-1">
                Không dùng Realtime priority. Auto concurrency ≤ 10.
              </p>
            </div>
          )}

          {!isAuto && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="RAM tối thiểu (MB)"
                  type="number"
                  value={formData.defaultMinMemoryMb}
                  onChange={(e) => handleChange('defaultMinMemoryMb', parseInt(e.target.value) || 512)}
                />
                <Input
                  label="RAM tối đa (MB)"
                  type="number"
                  value={formData.defaultMaxMemoryMb}
                  onChange={(e) => handleChange('defaultMaxMemoryMb', parseInt(e.target.value) || 1024)}
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl hover:bg-accent/30 transition-colors">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={Boolean(formData.enableLaunchBoost)}
                    onChange={(e) => handleChange('enableLaunchBoost', e.target.checked)}
                  />
                  <div className="h-5 w-5 rounded-md border-2 border-border bg-input transition-all peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Bật Launch Boost</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tăng độ ưu tiên process Minecraft lúc load. Không dùng Realtime.
                  </p>
                </div>
              </label>

              {formData.enableLaunchBoost && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Độ ưu tiên</span>
                    <select
                      value={formData.launchBoostPriority}
                      onChange={(e) => handleChange('launchBoostPriority', e.target.value)}
                      className="h-10 px-3 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="above_normal">Above Normal</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Thời gian boost</span>
                    <select
                      value={formData.launchBoostDurationMs}
                      onChange={(e) => handleChange('launchBoostDurationMs', parseInt(e.target.value))}
                      className="h-10 px-3 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="30000">30 giây</option>
                      <option value="45000">45 giây</option>
                      <option value="60000">60 giây</option>
                    </select>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl hover:bg-accent/30 transition-colors">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={Boolean(formData.enableAutoPrepareGame)}
                    onChange={(e) => handleChange('enableAutoPrepareGame', e.target.checked)}
                  />
                  <div className="h-5 w-5 rounded-md border-2 border-border bg-input transition-all peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Auto Prepare (tải trước nền)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tải libraries/assets khi chọn profile.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl hover:bg-accent/30 transition-colors">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={Boolean(formData.fastLaunchMode)}
                    onChange={(e) => handleChange('fastLaunchMode', e.target.checked)}
                  />
                  <div className="h-5 w-5 rounded-md border-2 border-border bg-input transition-all peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Fast Launch Mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Bỏ quét nặng nếu profile đã prepared.</p>
                </div>
              </label>

              <div className="flex flex-col gap-1.5 pl-3">
                <span className="text-xs font-semibold text-muted-foreground">Download concurrency (≤16)</span>
                <select
                  value={formData.downloadConcurrency}
                  onChange={(e) => handleChange('downloadConcurrency', parseInt(e.target.value))}
                  className="h-10 px-3 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary max-w-xs"
                >
                  <option value="4">4</option>
                  <option value="8">8</option>
                  <option value="10">10</option>
                  <option value="12">12</option>
                  <option value="16">16</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              type="button"
              onClick={async () => {
                if (window.launcherApi) {
                  const ok = await window.launcherApi.clearVersionManifestCache()
                  if (ok) alert('Đã xóa cache manifest phiên bản game!')
                }
              }}
              variant="outline"
              size="sm"
            >
              Xóa cache manifest
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (window.launcherApi) {
                  const ok = await window.launcherApi.clearPreparedProfilesCache()
                  if (ok) alert('Đã xóa cache prepared profiles!')
                }
              }}
              variant="outline"
              size="sm"
            >
              Xóa cache Prepared
            </Button>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">An toàn</p>
              <p className="opacity-80 mt-0.5">
                Không dùng Realtime priority. Boost chỉ áp dụng PID Minecraft. Auto mode tự clamp concurrency ≤ 10.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
