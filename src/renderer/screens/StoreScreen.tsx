import { useState, useEffect } from 'react'
import { Search, Download, Star, Loader2, PackageOpen, Layers } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/button'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { Badge } from '../components/ui/Badge'
import type { ModrinthProject, ModrinthVersion, ModrinthSearchResult } from '../../shared/types'

interface StoreScreenProps {
  onInstallSuccess?: (profileId: string) => void
}

export const StoreScreen = ({ onInstallSuccess }: StoreScreenProps) => {
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<ModrinthSearchResult['hits']>([])
  const [loading, setLoading] = useState(false)
  
  // Modal state
  const [selectedProject, setSelectedProject] = useState<ModrinthSearchResult['hits'][0] | null>(null)
  const [versions, setVersions] = useState<ModrinthVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  
  const [installing, setInstalling] = useState<string | null>(null)

  const searchProjects = async (q: string) => {
    setLoading(true)
    try {
      const res = await window.launcherApi.searchModrinth(q || '', 'modpack', 0)
      setProjects(res.hits)
    } catch (err) {
      console.error(err)
      showToast('error', 'Lỗi khi tìm kiếm Modrinth')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    searchProjects('')
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchProjects(query)
  }

  const openProject = async (project: ModrinthSearchResult['hits'][0]) => {
    setSelectedProject(project)
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
    showToast('info', `Bắt đầu cài đặt ${selectedProject.title}... Vui lòng chờ vài phút.`)
    try {
      const profileId = await window.launcherApi.installModrinthModpack(version.id, `${selectedProject.title} (${version.version_number})`)
      showToast('success', `Đã cài đặt xong Modpack: ${selectedProject.title}`)
      setSelectedProject(null)
      if (onInstallSuccess && profileId) {
        onInstallSuccess(profileId)
      }
    } catch (err) {
      console.error(err)
      showToast('error', `Lỗi cài đặt: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setInstalling(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/60 bg-card/40 flex-shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-primary" />
          Cửa Hàng Modpack
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Tìm kiếm và cài đặt hàng ngàn Modpack từ Modrinth chỉ với 1 click.</p>
        
        <form onSubmit={handleSearch} className="mt-4 flex gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nhập tên modpack (VD: Fabulously Optimized, RLcraft...)"
              className="pl-10 h-11 text-base bg-accent/20 border-accent/40 rounded-xl"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-11 px-6 rounded-xl font-bold text-sm" disabled={loading}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {projects.map((project) => (
              <div
                key={project.project_id}
                onClick={() => openProject(project)}
                className="group relative flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all cursor-pointer"
              >
                {/* Banner / Icon area */}
                <div className="h-32 bg-zinc-900 flex items-center justify-center overflow-hidden border-b border-border/50 relative">
                  {project.icon_url ? (
                    <img src={project.icon_url} alt={project.title} className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity blur-[2px] scale-110" />
                  ) : (
                    <Layers className="h-12 w-12 text-zinc-800" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  
                  {project.icon_url && (
                    <img src={project.icon_url} className="absolute h-16 w-16 rounded-xl shadow-lg border border-border/50 z-10 bg-card" />
                  )}
                </div>
                
                {/* Details */}
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-base text-foreground line-clamp-1">{project.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-3 line-clamp-2 flex-1">
                    {project.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-[11px] font-medium mt-auto pt-3 border-t border-border/50 text-muted-foreground">
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
          <h4 className="font-bold text-foreground text-sm flex items-center gap-2 border-b border-border/60 pb-2">
            <Layers className="h-4 w-4 text-primary" /> Các phiên bản (Versions)
          </h4>
          
          <div className="bg-accent/10 border border-border/60 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
            {loadingVersions ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : versions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Không có phiên bản nào khả dụng.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-accent/40 text-xs uppercase text-muted-foreground sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tên / Số phiên bản</th>
                    <th className="px-4 py-3 font-semibold">Minecraft</th>
                    <th className="px-4 py-3 font-semibold">Cập nhật</th>
                    <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {versions.map(v => (
                    <tr key={v.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{v.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{v.version_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {v.game_versions.slice(0, 3).map(mc => (
                            <Badge key={mc} variant="secondary" className="text-[10px] bg-zinc-800/50">{mc}</Badge>
                          ))}
                          {v.game_versions.length > 3 && (
                            <Badge variant="secondary" className="text-[10px] bg-zinc-800/50">+{v.game_versions.length - 3}</Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 capitalize">{v.loaders?.join(', ')}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(v.date_published).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          onClick={() => handleInstall(v)} 
                          disabled={!!installing}
                          size="sm"
                          className="h-8 text-xs font-bold px-4"
                        >
                          {installing === v.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Đang cài</>
                          ) : 'Cài đặt'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
