import { useState } from 'react'
import {
  HelpCircle,
  Heart,
  Zap,
  Cpu,
  Globe,
  Sliders,
  FolderArchive,
  Shirt,
  UserCheck,
  CheckCircle2,
  Boxes,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import pkg from '../../../package.json'
import { cn } from '@/lib/utils'

interface FeatureItem {
  id: string
  category: 'engine' | 'management' | 'studio'
  title: string
  tagline: string
  description: string
  icon: any
  iconColor: string
  badge: string
  highlights: string[]
}

const FEATURE_LIST: FeatureItem[] = [
  {
    id: 'engine',
    category: 'engine',
    title: 'Khởi động đa nền tảng',
    tagline: 'Forge, NeoForge, Fabric, Quilt & Vanilla',
    description: 'Chạy game mượt mà, hỗ trợ tất cả phiên bản và loader Minecraft.',
    icon: Zap,
    iconColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    badge: 'Lõi Game',
    highlights: ['Hỗ trợ đầy đủ Loader', 'Tiết kiệm tài nguyên', 'Tải game siêu tốc'],
  },
  {
    id: 'store',
    category: 'management',
    title: 'Kho Mod Modrinth',
    tagline: 'Cài Mod, Modpack & Shader 1-click',
    description: 'Tìm kiếm và tải trực tiếp hàng ngàn tài nguyên miễn phí.',
    icon: Boxes,
    iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    badge: 'Kho Mod',
    highlights: ['Cài modpack 1-click', 'Tự tải kèm mod phụ thuộc', 'Tìm kiếm & lọc nhanh'],
  },
  {
    id: 'java',
    category: 'engine',
    title: 'Tự động cài Java',
    tagline: 'Tự phát hiện và tải Java chuẩn',
    description: 'Tự tìm và tải phiên bản Java tương thích nhất, không cần cài thủ công.',
    icon: Cpu,
    iconColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
    badge: 'Tự Động',
    highlights: ['OpenJDK chính thức', 'Quét Java trên máy', 'Khắc phục lỗi Java'],
  },
  {
    id: 'optimizer',
    category: 'engine',
    title: 'Tối ưu hóa & Tăng FPS',
    tagline: 'Bộ cờ mượt mà và dọn rác',
    description: 'Tối ưu bộ nhớ RAM, ép dùng card đồ họa rời giúp game ổn định.',
    icon: Sliders,
    iconColor: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
    badge: 'Tăng FPS',
    highlights: ['Cấu hình tăng FPS', 'Ưu tiên card rời', 'Dọn rác bộ nhớ đệm'],
  },
  {
    id: 'mod_conflict',
    category: 'management',
    title: 'Chẩn đoán xung đột mod',
    tagline: 'Phát hiện mod lỗi trước khi mở game',
    description: 'Tự nhận diện mod không tương thích hoặc sai Loader để tránh crash.',
    icon: ShieldAlert,
    iconColor: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    badge: 'Chống Crash',
    highlights: ['Phát hiện mod xung đột', 'Báo sai phiên bản', 'Sửa lỗi 1-click'],
  },
  {
    id: 'share_backup',
    category: 'management',
    title: 'Sao lưu & Chia sẻ',
    tagline: 'Gửi gói game cho bạn bè qua 1 file',
    description: 'Đóng gói mod, phím bấm và cài đặt để chia sẻ hoặc khôi phục nhanh.',
    icon: FolderArchive,
    iconColor: 'text-primary bg-primary/15 border-primary/30',
    badge: 'Chia Sẻ',
    highlights: ['Gửi mod cho bạn bè', 'Giữ nguyên cài đặt & phím', 'Khôi phục tức thì'],
  },
  {
    id: 'skin_cape',
    category: 'studio',
    title: 'Kho Skin 3D',
    tagline: 'Đổi skin và xem trước chuyển động 3D',
    description: 'Xem trước trang phục nhân vật 360 độ và kho 400+ skin đẹp có sẵn.',
    icon: Shirt,
    iconColor: 'text-violet-400 bg-violet-500/15 border-violet-500/30',
    badge: 'Skin 3D',
    highlights: ['Xem trước chuyển động 3D', 'Kho 400+ skin có sẵn', 'Hỗ trợ tay nhỏ & to'],
  },
  {
    id: 'accounts',
    category: 'studio',
    title: 'Quản lý tài khoản',
    tagline: 'Hỗ trợ Microsoft & Offline',
    description: 'Lưu nhiều tài khoản và chuyển đổi qua lại nhanh chóng.',
    icon: UserCheck,
    iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    badge: 'Tài Khoản',
    highlights: ['Đăng nhập Microsoft', 'Tài khoản Offline miễn phí', 'Đổi tài khoản 1-click'],
  },
]

export function AboutScreen() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'engine' | 'management' | 'studio'>('all')

  const filteredFeatures =
    activeCategory === 'all'
      ? FEATURE_LIST
      : FEATURE_LIST.filter((f) => f.category === activeCategory)

  return (
    <div className="px-6 pt-2 pb-8 max-w-5xl mx-auto flex flex-col gap-5 select-none">
      {/* Hero Header Banner */}
      <div className="p-5 rounded-md border border-zinc-800/60 bg-zinc-950/45 relative overflow-hidden shadow-xs">
        {/* Glow Ambient */}
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center p-2 shrink-0 shadow-inner">
              <img src="./logo.png" alt="LetCuteMC Logo" loading="lazy" decoding="async" className="h-full w-full object-contain" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-foreground/85 tracking-tight">LetCuteMC Launcher</h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono">
                  v{pkg.version}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Miễn phí
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                Minecraft Launcher nhẹ mượt: Khởi động nhanh, tối ưu FPS, tải Modrinth trực tiếp và hỗ trợ 3D Skin Studio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <Button
              variant="elevated"
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 flex-1 md:flex-initial"
              onClick={() => window.launcherApi.openExternal('https://discord.gg/rRZujVzPRx')}
            >
              <HelpCircle size={13} />
              Discord hỗ trợ
            </Button>
            <Button
              size="sm"
              className="h-8 px-3.5 text-xs font-semibold gap-1.5 flex-1 md:flex-initial"
              onClick={() => window.launcherApi.openExternal('https://letcute.com')}
            >
              <Globe size={13} />
              Trang chủ
            </Button>
          </div>
        </div>

        {/* Tech Stack Badges */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="font-semibold text-zinc-300">Nền tảng:</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-zinc-300">Electron</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-cyan-400">React & Vite</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-primary">XMCL Core</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-emerald-400">OpenJDK Temurin</span>
        </div>
      </div>

      {/* Main Feature Showcase Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-foreground">Tính năng nổi bật ({FEATURE_LIST.length})</h3>
            <p className="text-xs text-muted-foreground">Các tiện ích có sẵn trong LetCuteMC</p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-950/80 border border-zinc-800/80 rounded-md">
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                activeCategory === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Tất cả ({FEATURE_LIST.length})
            </button>
            <button
              onClick={() => setActiveCategory('engine')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                activeCategory === 'engine'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Hiệu năng
            </button>
            <button
              onClick={() => setActiveCategory('management')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                activeCategory === 'management'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Quản lý Mod
            </button>
            <button
              onClick={() => setActiveCategory('studio')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                activeCategory === 'studio'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Tiện ích & Skin
            </button>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFeatures.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.id}
                className="p-3.5 rounded-md border border-zinc-800/60 bg-zinc-950/45 hover:border-zinc-700/60 hover:bg-zinc-950/70 transition-all duration-200 shadow-xs flex flex-col justify-between gap-3 group cv-auto"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn('h-9 w-9 rounded-md border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', item.iconColor)}>
                      <Icon size={18} />
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                      {item.badge}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] font-medium text-primary/90 mt-0.5">
                      {item.tagline}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 space-y-1">
                  {item.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                      <CheckCircle2 size={10} className="text-primary shrink-0" />
                      <span className="truncate">{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom Section: Unified Developer & Donation Footer Card */}
      <div className="p-5 rounded-md border border-zinc-800/60 bg-zinc-950/45 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 relative overflow-hidden cv-auto">
        {/* Glow ambient */}
        <div className="absolute right-0 bottom-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Left Side: Developer Info */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3.5">
            <img
              src="./assets/avatarv2-modified.png"
              alt="LetCute Avatar"
              loading="lazy"
              decoding="async"
              className="h-12 w-12 rounded-md object-contain drop-shadow-md border border-primary/30 p-1 bg-zinc-950 shrink-0"
            />
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-foreground">Phát triển bởi LetCute</h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  Lead Developer
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tâm huyết xây dựng nền tảng Minecraft Launcher tối ưu, miễn phí và hiện đại nhất cho cộng đồng game thủ Việt Nam.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-muted-foreground">
            <span>Bản quyền © 2026 LetCuteMC</span>
            <span>·</span>
            <span className="font-semibold text-zinc-300">Made with ❤️ in Vietnam</span>
          </div>
          <p className="text-[10px] text-muted-foreground/75 leading-relaxed">
            * LetCuteMC không liên kết hay được chứng thực bởi Mojang, Microsoft hay Prism Launcher. Minecraft là thương hiệu của Mojang AB. Luồng đăng nhập Microsoft sử dụng OAuth ID chung của cộng đồng mã nguồn mở.
          </p>
        </div>

        {/* Right Side: Sleek & Compact Donate Box */}
        <div className="md:w-80 p-3 rounded-md border border-zinc-800 bg-zinc-950/70 flex items-center gap-3.5 shrink-0 shadow-inner">
          <div className="p-1 bg-white rounded-md shadow-md shrink-0 transition-transform hover:scale-105">
            <img
              src="./assets/qr_donate.png"
              alt="QR Donate"
              className="w-18 h-18 object-contain rounded"
            />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Heart size={13} className="text-red-400 fill-red-400/20 animate-pulse" />
              <span>Ủng Hộ Dự Án</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Quét mã QR để tiếp thêm động lực duy trì server và tính năng mới!
            </p>
            <div className="flex items-center gap-1 pt-0.5 flex-wrap">
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Momo
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                VNPay
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ngân Hàng
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AboutScreen
