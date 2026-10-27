import { useState, useEffect } from 'react'
import { Search, Download, Loader2, PackageOpen, Layers, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/button'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { Badge } from '../components/ui/Badge'
import type { ModrinthVersion, ModrinthSearchResult, StoreInstallation, LauncherProfile } from '../../shared/types'
import { ModrinthIcon } from '@/components/icons/ModrinthIcon'

interface StoreScreenProps {
  gameDir?: string
  profiles?: LauncherProfile[]
  activeProfileId?: string | null
  onInstallSuccess?: (profileId: string) => void
}

function detectLoader(versionStr: string): string {
  const lower = (versionStr || '').toLowerCase()
  if (lower.includes('fabric')) return 'fabric'
  if (lower.includes('quilt')) return 'quilt'
  if (lower.includes('neoforge')) return 'neoforge'
  if (lower.includes('forge')) return 'forge'
  return 'unknown'
}

function extractMcVersion(versionStr: string): string {
  if (!versionStr) return ''
  const clean = versionStr.replace(/^(?:fabric|quilt|neoforge|forge)-loader-[^-]+-/i, '')
  const matchSuffix = clean.match(/^(\d+(?:\.\d+)+)-(?:fabric|quilt|forge|neoforge)/i)
  if (matchSuffix?.[1]) return matchSuffix[1]
  const match = clean.match(/(?:^|[^0-9])(1\.\d+(?:\.\d+)?)/)
  if (match?.[1]) return match[1]
  return clean
}

export const StoreScreen = ({ gameDir, profiles = [], activeProfileId }: StoreScreenProps) => {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<ModrinthSearchResult['hits']>([])
  const [loading, setLoading] = useState(false)

  // Modal state
  const [selectedProject, setSelectedProject] = useState<ModrinthSearchResult['hits'][0] | null>(null)
  const [versions, setVersions] = useState<ModrinthVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  const [installing, setInstalling] = useState<string | null>(null)

  const [projectType, setProjectType] = useState<'modpack' | 'mod' | 'shader' | 'resourcepack'>('modpack')
  const [installations, setInstallations] = useState<StoreInstallation[]>([])
  const [filterByActiveProfile, setFilterByActiveProfile] = useState<boolean>(true)

  // Custom import modal state
  const [importModalState, setImportModalState] = useState<{
    isOpen: boolean;
    mode: 'link' | 'file';
    filePath?: string;
  } | null>(null)
  const [importInputValue, setImportInputValue] = useState('')
  const [importProfileName, setImportProfileName] = useState('')

  const currentActiveProfile = profiles.find((p) => p.id === activeProfileId)
  const profileMcVersion = currentActiveProfile ? extractMcVersion(currentActiveProfile.minecraftVersion) : ''
  const profileLoader = currentActiveProfile ? detectLoader(currentActiveProfile.minecraftVersion) : ''

  const loadInstallations = async () => {
    const activeDir = currentActiveProfile?.gameDir || gameDir
    if (!activeDir) return
    try {
      const data = await window.launcherApi.getStoreInstallations(activeDir)
      setInstallations(data)
    } catch (e) {
      console.error(e)
    }
  }

  const searchProjects = async (q: string, type: string) => {
    setLoading(true)
    try {
      // Modpacks do not need profile filtering as they create their own profile
      const isContentPack = type !== 'modpack'
      const gv = isContentPack && filterByActiveProfile && profileMcVersion ? profileMcVersion : undefined
      const ld = isContentPack && filterByActiveProfile && profileLoader && profileLoader !== 'unknown' && type === 'mod' ? profileLoader : undefined
      const res = await window.launcherApi.searchModrinth(q || '', type, 0, gv, ld)
      setProjects(res.hits)
    } catch (err) {
      console.error(err)
      showToast('error', 'Lỗi khi tìm kiếm Modrinth')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    searchProjects(query, projectType)
    loadInstallations()
    
    const unsubscribe = window.launcherApi.onTasksUpdate((event) => {
      if (event.type === 'task-completed') {
        const { task } = event
        if (task.taskType === 'install-mod' && task.result?.gameDir === gameDir) {
          loadInstallations()
        }
      }
    })
    
    return () => unsubscribe()
  }, [projectType, gameDir, filterByActiveProfile, activeProfileId])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchProjects(query, projectType)
  }

  const [showAllVersions, setShowAllVersions] = useState<boolean>(false)

  const openProject = async (project: ModrinthSearchResult['hits'][0]) => {
    setSelectedProject(project)
    setShowAllVersions(false)
    setLoadingVersions(true)
    setVersions([])
    try {
      const v = await window.launcherApi.getModrinthVersions(project.project_id)
      setVersions(v)
    } catch (err) {
      console.error(err)
      showToast('error', 'Không thể tải phiên bản')
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleInstall = async (version: ModrinthVersion) => {
    if (!selectedProject) return
    setInstalling(version.id)
    try {
      if (projectType === 'modpack') {
        await window.launcherApi.installModrinthModpack(version.id, `${selectedProject.title} (${version.version_number})`)
        showToast('success', `Đã thêm vào Tiến trình tải xuống`)
        setSelectedProject(null)
      } else {
        const targetProfile = currentActiveProfile
        if (!targetProfile || !targetProfile.gameDir) throw new Error('Không tìm thấy thư mục của cấu hình đang chọn.')

        // Compatibility check
        const compatible = !profileMcVersion || version.game_versions.includes(profileMcVersion)
        if (!compatible) {
          const proceed = await confirm({
            title: 'Cảnh báo tương thích',
            message: `Mod này có thể không tương thích với phiên bản Minecraft của cấu hình (${targetProfile.minecraftVersion}).\nPhiên bản hỗ trợ: ${version.game_versions.join(', ')}.\nBạn có chắc chắn muốn cài đặt?`,
            isDestructive: true
          })
          if (!proceed) {
             setInstalling(null)
             return;
          }
        }

        await window.launcherApi.installStoreMod(version.id, targetProfile.gameDir)
        showToast('success', `Đã cài đặt: ${selectedProject.title}`)

        // Refresh installations
        await loadInstallations()
      }
    } catch (err) {
      console.error(err)
      showToast('error', `Lỗi cài đặt: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setInstalling(null)
    }
  }

  const handleUninstall = async (projectId: string) => {
    if (!gameDir) return
    try {
      const ok = await window.launcherApi.uninstallStoreItem(projectId, gameDir)
      if (ok) {
        showToast('success', 'Đã gỡ cài đặt thành công.')
        await loadInstallations()
      }
    } catch (err) {
      showToast('error', 'Lỗi khi gỡ cài đặt')
    }
  }

  return (
    <div className="flex flex-col h-full text-foreground">
      {/* Header */}
      <div className="px-6 pt-0 pb-5 flex-shrink-0">
        <div className="flex justify-between items-center w-full">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ModrinthIcon className="h-5 w-5 text-primary" />
              Cửa Hàng Modrinth
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Tìm kiếm và cài đặt hàng ngàn Modpack và Mod chỉ với 1 click.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => {
              setImportModalState({ isOpen: true, mode: 'link' })
              setImportInputValue('')
              setImportProfileName('Imported Modpack')
            }}>
              <Download className="h-4 w-4 mr-2" />
              Nhập từ Link
            </Button>
            <Button variant="primary" size="sm" onClick={async () => {
              const file = await window.launcherApi.openFileDialog([{ name: 'Modrinth Pack', extensions: ['mrpack'] }])
              if (!file) return;

              setImportModalState({ isOpen: true, mode: 'file', filePath: file })
              setImportProfileName('Local Modpack')
            }}>
              <PackageOpen className="h-4 w-4 mr-2" />
              Nhập File .mrpack
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={projectType === 'modpack' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setProjectType('modpack')}
            >
              Modpacks
            </Button>
            <Button
              variant={projectType === 'mod' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setProjectType('mod')}
            >
              Mods
            </Button>
            <Button
              variant={projectType === 'shader' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setProjectType('shader')}
            >
              Shaders
            </Button>
            <Button
              variant={projectType === 'resourcepack' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setProjectType('resourcepack')}
            >
              Resource Packs
            </Button>
          </div>

          {/* Filter toggle only for content packs (mods, shaders, resourcepacks) */}
          {projectType !== 'modpack' && currentActiveProfile && (
            <button
              type="button"
              onClick={() => setFilterByActiveProfile(!filterByActiveProfile)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                filterByActiveProfile
                  ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${filterByActiveProfile ? 'bg-primary' : 'bg-zinc-600'}`} />
              <span>
                Lọc theo cấu hình: <strong className="text-foreground">{currentActiveProfile.name}</strong> ({profileMcVersion || 'All'}{profileLoader !== 'unknown' ? ` · ${profileLoader}` : ''})
              </span>
            </button>
          )}
        </div>

        <form onSubmit={handleSearch} className="mt-4 flex gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none z-10" />
            <Input
              placeholder="Nhập tên modpack (VD: Fabulously Optimized, RLcraft...)"
              className="pl-10 h-10 text-xs bg-zinc-900/90 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-primary/60 rounded-md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-10 px-5 rounded-md font-bold text-xs" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tìm kiếm'}
          </Button>
        </form>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
            <PackageOpen className="h-12 w-12 mb-3 opacity-20" />
            <p>Không tìm thấy Modpack nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <div
                key={project.project_id}
                onClick={() => openProject(project)}
                className="group relative flex flex-col bg-zinc-900/85 border border-zinc-800/80 rounded-md overflow-hidden hover:border-primary/50 hover:bg-zinc-900 transition-all duration-200 shadow-md cursor-pointer cv-auto"
              >
                {/* Banner / Icon area */}
                <div className="h-32 bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-800/80 relative">
                  {project.icon_url ? (
                    <img src={project.icon_url} alt={project.title} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity blur-[2px] scale-110" />
                  ) : (
                    <Layers className="h-12 w-12 text-zinc-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-transparent" />

                  {project.icon_url && (
                    <img src={project.icon_url} alt={project.title} loading="lazy" decoding="async" className="absolute h-16 w-16 rounded-md shadow-lg border border-zinc-700/60 z-10 bg-zinc-900" />
                  )}

                  {installations.some(i => i.projectId === project.project_id) && (
                    <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm backdrop-blur-md">
                      <CheckCircle className="h-3 w-3" /> Đã cài
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">{project.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-3 line-clamp-2 flex-1">
                    {project.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-medium mt-auto pt-3 border-t border-zinc-800 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(project.downloads)}
                    </span>
                    <span>Tác giả: {project.author}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedProject}
        onClose={() => !installing && setSelectedProject(null)}
        title={selectedProject?.title || ''}
        description={selectedProject?.description}
        maxWidth="max-w-4xl"
      >
        <div className="flex flex-col gap-4">
          {projectType !== 'modpack' && currentActiveProfile && (
            <div className="flex items-center justify-between p-3 bg-zinc-900/90 border border-zinc-800 rounded-md mb-1 text-xs">
              <span className="text-muted-foreground">
                Cài đặt vào cấu hình: <strong className="text-foreground">{currentActiveProfile.name}</strong>
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                {profileMcVersion || currentActiveProfile.minecraftVersion} {profileLoader !== 'unknown' && `· ${profileLoader}`}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Các phiên bản (Versions)
            </h4>
            {projectType !== 'modpack' && profileMcVersion && (
              <button
                type="button"
                onClick={() => setShowAllVersions(!showAllVersions)}
                className="text-xs text-primary hover:underline font-medium"
              >
                {showAllVersions ? 'Chỉ hiện bản tương thích' : 'Hiện tất cả phiên bản'}
              </button>
            )}
          </div>

          <div className="bg-accent/10 border border-border/60 rounded-md overflow-hidden max-h-[50vh] overflow-y-auto">
            {loadingVersions ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : versions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Không có phiên bản nào khả dụng.</div>
            ) : (() => {
              const shouldFilter = projectType !== 'modpack' && !showAllVersions && Boolean(profileMcVersion)
              const compatibleVersions = versions.filter(v => {
                const isGameVerMatch = !profileMcVersion || v.game_versions.includes(profileMcVersion)
                const isLoaderMatch = !profileLoader || profileLoader === 'unknown' || v.loaders.includes(profileLoader)
                return isGameVerMatch && (projectType !== 'mod' || isLoaderMatch)
              })
              const displayList = shouldFilter ? compatibleVersions : versions

              if (shouldFilter && displayList.length === 0) {
                const typeLabel = projectType === 'mod' ? 'Mod' : projectType === 'shader' ? 'Shader' : 'Resource Pack'
                return (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">
                        Phiên bản Minecraft ({profileMcVersion}{profileLoader !== 'unknown' && projectType === 'mod' ? ` · ${profileLoader}` : ''}) của bạn không được {typeLabel} này hỗ trợ.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Hãy chuyển sang cấu hình phiên bản khác hoặc xem tất cả phiên bản cũ hơn / mới hơn bên dưới.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => setShowAllVersions(true)}
                    >
                      Xem tất cả phiên bản ({versions.length})
                    </Button>
                  </div>
                )
              }

              return (
                <table className="w-full text-left text-sm">
                  <thead className="bg-background z-10 text-xs uppercase text-muted-foreground sticky top-0 border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Tên / Số phiên bản</th>
                      <th className="px-4 py-3 font-semibold">Minecraft</th>
                      <th className="px-4 py-3 font-semibold">Cập nhật</th>
                      <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {displayList.map(v => {
                      const isGameVerMatch = !profileMcVersion || v.game_versions.includes(profileMcVersion)
                      const isLoaderMatch = !profileLoader || profileLoader === 'unknown' || v.loaders.includes(profileLoader)
                      const isRecommended = isGameVerMatch && (projectType !== 'mod' || isLoaderMatch)

                      return (
                        <tr key={v.id} className={`hover:bg-accent/20 transition-colors ${isRecommended ? 'bg-primary/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{v.name}</span>
                              {isRecommended && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Tương thích
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{v.version_number}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {v.game_versions.slice(0, 3).map(mc => (
                                <Badge key={mc} variant={mc === profileMcVersion ? 'primary' : 'secondary'} className={`text-[10px] ${mc === profileMcVersion ? 'bg-primary text-primary-foreground font-bold' : 'bg-zinc-800/50'}`}>
                                  {mc}
                                </Badge>
                              ))}
                              {v.game_versions.length > 3 && (
                                <Badge variant="secondary" className="text-[10px] bg-zinc-800/50">+{v.game_versions.length - 3}</Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 capitalize font-medium">
                              {v.loaders?.map(ld => (
                                <span key={ld} className={ld === profileLoader ? 'text-primary font-bold' : ''}>
                                  {ld}{' '}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(v.date_published).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                            {installations.some(i => i.projectId === selectedProject?.project_id && i.versionId === v.id) ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={true}
                                  className="h-8 text-xs font-bold text-emerald-500 bg-emerald-500/10 opacity-100 px-4"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1.5" /> Đã cài
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="icon-sm"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => selectedProject && handleUninstall(selectedProject.project_id)}
                                  title="Gỡ cài đặt"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                onClick={() => handleInstall(v)}
                                disabled={!!installing}
                                variant={isRecommended ? 'primary' : 'outline'}
                                size="sm"
                                className="h-8 text-xs font-bold px-4 shadow-none"
                              >
                                {installing === v.id ? (
                                  <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Đang cài</>
                                ) : isRecommended ? (
                                  'Cài đặt'
                                ) : (
                                  'Cài đặt (Khác bản)'
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })()}
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={!!importModalState?.isOpen}
        onClose={() => setImportModalState(null)}
        title={importModalState?.mode === 'link' ? "Nhập Modpack từ Link" : "Nhập Modpack từ File"}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          {importModalState?.mode === 'link' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground">Link Modrinth hoặc Version ID:</label>
              <Input
                placeholder="https://modrinth.com/modpack/.../version/..."
                value={importInputValue}
                onChange={(e) => setImportInputValue(e.target.value)}
                className="bg-zinc-900/90 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-primary/60 rounded-md"
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground">Tên cấu hình mới:</label>
            <Input
              placeholder="VD: Fabulously Optimized"
              value={importProfileName}
              onChange={(e) => setImportProfileName(e.target.value)}
              className="bg-zinc-900/90 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-primary/60 rounded-md"
            />
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setImportModalState(null)}>Hủy</Button>
            <Button variant="primary" disabled={loading || !importProfileName || (importModalState?.mode === 'link' && !importInputValue)} onClick={async () => {
              const state = importModalState;
              if (!state) return;
              
              setImportModalState(null);
              setLoading(true);

              try {
                if (state.mode === 'link') {
                  let versionId = importInputValue;
                  const match = importInputValue.match(/version\/([a-zA-Z0-9]+)/);
                  if (match?.[1]) {
                    versionId = match[1];
                  }
                  showToast('info', `Đã thêm vào Tiến trình...`);
                  await window.launcherApi.installModrinthModpack(versionId, importProfileName);
                } else {
                  if (!state.filePath) throw new Error("Không có đường dẫn file");
                  showToast('info', `Đã thêm vào Tiến trình...`);
                  await window.launcherApi.installLocalModrinthModpack(state.filePath, importProfileName);
                }
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                showToast('error', `Lỗi: ${message}`);
              } finally {
                setLoading(false);
              }
            }}>
              Xác nhận
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
