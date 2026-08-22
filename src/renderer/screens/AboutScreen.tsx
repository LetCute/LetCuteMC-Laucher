import { useState } from 'react'
import {
  HelpCircle,
  Heart,
  Zap,
  Package,
  Layers,
  Sparkles,
  Cpu,
  Globe,
  Sliders,
  FolderArchive,
  Camera,
  FileText,
  BarChart3,
  Shirt,
  UserCheck,
  CheckCircle2,
  Boxes,
  ShieldAlert,
  ArrowUpCircle,
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
    title: 'Lõi Khởi Động Đa Nền Tảng (Multi-Loader Engine)',
    tagline: 'Hỗ trợ Forge, NeoForge, Fabric, Quilt & Vanilla',
    description: 'Chạy game trên luồng Worker độc lập (UtilityProcess) đảm bảo Launcher luôn mượt mà không bị đơ lag.',
    icon: Zap,
    iconColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    badge: 'Đa Nền Tảng',
    highlights: ['Hỗ trợ Windows & Linux & macOS', 'Worker I/O biệt lập', 'Tự giải phóng bộ nhớ'],
  },
  {
    id: 'java',
    category: 'engine',
    title: 'Quét & Tự Cài Đặt Java Thông Minh',
    tagline: 'Tự động phát hiện và tải OpenJDK Temurin chuẩn',
    description: 'Quét sâu hệ thống (JDK 8, 17, 21, 24), tự động đối soát phiên bản yêu cầu và tải cài đặt 1-click.',
    icon: Cpu,
    iconColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
    badge: 'Tự Động 100%',
    highlights: ['Adoptium Temurin OpenJDK', 'Quét PATH, SDKMAN, jEnv', 'Tự cấu hình Java Home'],
  },
  {
    id: 'store',
    category: 'management',
    title: 'Cửa Hàng Modrinth Tích Hợp',
    tagline: 'Cài đặt Modpacks, Mods, Shaders & Texture Packs 1-click',
    description: 'Duyệt và tìm kiếm hàng triệu tài nguyên từ Modrinth, tự động phân tích và tải kèm các mod phụ thuộc.',
    icon: Boxes,
    iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    badge: 'Kho Mod Khủng',
    highlights: ['Cài modpack hoàn chỉnh', 'Tự tải mod phụ thuộc', 'Tìm kiếm & Lọc siêu nhanh'],
  },
  {
    id: 'share_backup',
    category: 'management',
    title: 'Sao Lưu & Chia Sẻ Trọn Gói (.letcutepack)',
    tagline: 'Đóng gói toàn bộ cấu hình để gửi bạn bè chỉ với 1 click',
    description: 'Nén mods, config, phím bấm, shader thành tệp .letcutepack hoặc .zip, hỗ trợ Kéo & Thả để chơi ngay.',
    icon: FolderArchive,
    iconColor: 'text-primary bg-primary/15 border-primary/30',
    badge: '1-Click Share',
    highlights: ['Kéo thả tệp tiện lợi', 'Đính kèm phím & cài đặt', 'Tạo cấu hình tức thì'],
  },
  {
    id: 'optimizer',
    category: 'engine',
    title: 'Tối Ưu Hóa Game & Cờ JVM Nâng Cao',
    tagline: '5 Bộ cờ Aikar, Shenandoah, ZGC, Low-End PC & Dọn Cache',
    description: 'Tối ưu bộ thu gom rác (GC) chống drop FPS, ép chạy Card đồ họa rời (NVIDIA/AMD) và dọn dẹp ổ đĩa.',
    icon: Sliders,
    iconColor: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
    badge: 'FPS Boost',
    highlights: ["Aikar's Flags & ZGC", 'Ép chạy GPU rời', 'Dọn dẹp rác ổ cứng'],
  },
  {
    id: 'worlds',
    category: 'management',
    title: 'Quản Lý Thế Giới (Worlds & Saves Studio)',
    tagline: 'Xem Seed, Datapacks, Đổi chế độ chơi & Sao lưu .zip',
    description: 'Quản lý toàn diện thế giới chơi đơn, nhân bản bản đồ, đổi độ khó, quản lý gói dữ liệu (Datapacks).',
    icon: Globe,
    iconColor: 'text-teal-400 bg-teal-500/15 border-teal-500/30',
    badge: 'Quản Lý Saves',
    highlights: ['Xem & Copy Seed', 'Sao lưu & Phục hồi .zip', 'Quản lý Datapacks'],
  },
  {
    id: 'mod_conflict',
    category: 'management',
    title: 'Kiểm Tra Xung Đột & Dự Đoán Crash (Conflict Predictor)',
    tagline: 'Quét xung đột OptiFine vs Sodium, sai Loader & tự động sửa 1-click',
    description: 'Chẩn đoán các lỗi xung đột rendering, trùng ID mod, thiếu Indium và cung cấp nút sửa tự động trước khi game mở.',
    icon: ShieldAlert,
    iconColor: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    badge: 'Chẩn Đoán Crash',
    highlights: ['OptiFine vs Sodium/Iris', 'Phát hiện sai Loader', 'Tự động sửa 1-click'],
  },
  {
    id: 'mod_updater',
    category: 'management',
    title: 'Tự Động Cập Nhật Mod (1-Click Mod Auto-Updater)',
    tagline: 'Đối soát SHA1/SHA512 với Modrinth & Cập nhật an toàn với Backup',
    description: 'Kiểm tra phiên bản mới của toàn bộ mod, xem nhật ký thay đổi (Changelog) và cập nhật 1 mod hoặc toàn bộ.',
    icon: ArrowUpCircle,
    iconColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
    badge: 'Auto Update',
    highlights: ['Đối soát băm SHA1/SHA512', 'Xem Changelog chi tiết', 'Tự động sao lưu bản cũ'],
  },
  {
    id: 'mod_fixer',
    category: 'management',
    title: 'Tự Động Sửa Lỗi Thiếu Mod (Auto-Fixer)',
    tagline: 'Quét file JAR và 1-click tải mod thiếu từ Modrinth',
    description: 'Quét phân tích fabric.mod.json / mods.toml, phát hiện mod thiếu và tự động tìm bản tải tương thích.',
    icon: Package,
    iconColor: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    badge: 'Chống Crash',
    highlights: ['Quét phụ thuộc mod', 'Tải 1-click tự động', 'Bật / Tắt / Xóa mod nhanh'],
  },
  {
    id: 'shaders_resource',
    category: 'management',
    title: 'Quản Lý Shaders & Resource Packs',
    tagline: 'Bật / Tắt và sắp xếp gói đổ bóng & kết cấu',
    description: 'Dễ dàng nhập, bật tắt các gói shader rực rỡ và gói kết cấu HD chỉ với các thao tác click chuột.',
    icon: Sparkles,
    iconColor: 'text-pink-400 bg-pink-500/15 border-pink-500/30',
    badge: 'Đồ Họa Đẹp',
    highlights: ['Hỗ trợ Iris / OptiFine', 'Nhập tệp kéo thả', 'Mở thư mục nhanh'],
  },
  {
    id: 'screenshots',
    category: 'studio',
    title: 'Thư Viện Ảnh Chụp Màn Hình (Lightbox)',
    tagline: 'Phóng to ảnh chất lượng cao & Copy trực tiếp Clipboard',
    description: 'Duyệt toàn bộ khoảnh khắc trong game, xem chi tiết, sao chép ảnh nhanh để dán lên Discord / Facebook.',
    icon: Camera,
    iconColor: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
    badge: 'Gallery',
    highlights: ['Lightbox phóng to', 'Copy ảnh vào Clipboard', 'Xóa chọn lọc nhanh'],
  },
  {
    id: 'logs',
    category: 'studio',
    title: 'Phân Tích Nhật Ký & Crash Analyzer',
    tagline: 'Tự động chẩn đoán lỗi & Upload 1-click lên mclo.gs',
    description: 'Bộ lọc mức log (Error, Warn, Info), phân tích thông minh nguyên nhân lỗi và gửi link chia sẻ trực tiếp.',
    icon: FileText,
    iconColor: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    badge: 'Chẩn Đoán Lỗi',
    highlights: ['Upload mclo.gs ra trình duyệt', 'Phát hiện mod gây crash', 'Tìm kiếm & Lọc dòng log'],
  },
  {
    id: 'stats',
    category: 'studio',
    title: 'Bảng Thống Kê Giờ Chơi & Hoạt Động (Stats)',
    tagline: 'Theo dõi thời gian chơi, khai khoáng, boss & di chuyển',
    description: 'Bảng dashboard theo dõi tiến trình sinh tồn: Kim cương đào được, số rồng đã hạ, km di chuyển bằng Elytra.',
    icon: BarChart3,
    iconColor: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
    badge: 'Playtime & Stats',
    highlights: ['Tổng giờ chơi launcher', 'Bảng vàng khai khoáng', 'Boss & Quái vật đã diệt'],
  },
  {
    id: 'skin_cape',
    category: 'studio',
    title: 'Studio Skin & Áo Choàng 3D (3D Skin Studio)',
    tagline: 'Xem 3D xoay 360 độ & Kho 400+ Skin hot NameMC',
    description: 'Tùy biến nhân vật trực quan với Skinview3D, đổi mẫu tay Slim/Classic, tải và áp dụng skin tức thì.',
    icon: Shirt,
    iconColor: 'text-violet-400 bg-violet-500/15 border-violet-500/30',
    badge: '3D Viewer',
    highlights: ['Xoay 3D tương tác', '400+ skin NameMC', 'Đổi skin Local & Microsoft'],
  },
  {
    id: 'accounts',
    category: 'studio',
    title: 'Quản Lý Tài Khoản (Microsoft & Offline)',
    tagline: 'Đăng nhập bảo mật OAuth2 & Tài khoản Khách (Guest)',
    description: 'Lưu trữ nhiều tài khoản cùng lúc, chuyển đổi tài khoản tức thì, đồng bộ avatar và trang phục.',
    icon: UserCheck,
    iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    badge: 'Tài Khoản',
    highlights: ['Microsoft OAuth2 chính chủ', 'Tài khoản Local Offline', 'Chuyển đổi tức thì'],
  },
  {
    id: 'navigation',
    category: 'engine',
    title: 'Menu Trượt 2 Tầng & Giao Diện Solid Dark SaaS',
    tagline: 'Thiết kế hiện đại, tinh gọn với Drawer Navigation',
    description: 'Thanh bên Sidebar phân cấp thông minh gom nhóm Quản lý Game (9 mục), giao diện kính tối sang trọng.',
    icon: Layers,
    iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    badge: 'UI / UX',
    highlights: ['Solid Dark SaaS Aesthetic', '2-Level Drawer Slider', 'Không giật lag'],
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
      <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 relative overflow-hidden shadow-md">
        {/* Glow Ambient */}
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center p-2 shrink-0 shadow-inner">
              <img src="./logo.png" alt="LetCuteMC Logo" loading="lazy" decoding="async" className="h-full w-full object-contain" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-foreground tracking-tight">LetCuteMC Launcher</h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono">
                  v{pkg.version}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  FREE & Open Source
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                Minecraft Launcher thế hệ mới dành cho game thủ: Khởi động siêu tốc, tối ưu FPS, tích hợp kho Mod Modrinth, 3D Skin Studio và sao lưu cấu hình 1-click.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs bg-zinc-900 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5 flex-1 md:flex-initial"
              onClick={() => window.launcherApi.openExternal('https://discord.gg/rRZujVzPRx')}
            >
              <HelpCircle size={13} />
              Discord Báo Lỗi
            </Button>
            <Button
              size="sm"
              className="h-8 px-3.5 text-xs font-semibold gap-1.5 flex-1 md:flex-initial"
              onClick={() => window.launcherApi.openExternal('https://letcute.com')}
            >
              <Globe size={13} />
              Trang Chủ
            </Button>
          </div>
        </div>

        {/* Tech Stack Badges */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="font-semibold text-zinc-300">Công nghệ:</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-zinc-300">Electron 43</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-cyan-400">React 19 & Vite</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-zinc-300">TailwindCSS</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-primary">XMCL Core Engine</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-purple-400">Skinview3D</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-emerald-400">Adoptium Temurin</span>
        </div>
      </div>

      {/* Main Feature Showcase Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-foreground">Hệ Thống Tính Năng Toàn Diện ({FEATURE_LIST.length} Tính năng)</h3>
            <p className="text-xs text-muted-foreground">Khám phá các công nghệ & tiện ích được tích hợp sẵn trong LetCuteMC</p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-950/80 border border-zinc-800/80 rounded-xl">
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
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
                'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
                activeCategory === 'engine'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              🚀 Hiệu Năng & Khởi Động
            </button>
            <button
              onClick={() => setActiveCategory('management')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
                activeCategory === 'management'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              📦 Quản Lý & Mods
            </button>
            <button
              onClick={() => setActiveCategory('studio')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
                activeCategory === 'studio'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              🎨 Studio & Thống Kê
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
                className="p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 hover:border-primary/50 hover:bg-zinc-900 transition-all duration-200 shadow-sm flex flex-col justify-between gap-3 group cv-auto"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn('h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', item.iconColor)}>
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
      <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 relative overflow-hidden cv-auto">
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
              className="h-12 w-12 rounded-xl object-contain drop-shadow-md border border-primary/30 p-1 bg-zinc-950 shrink-0"
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
            <span>Bản quyền © 2026 LetCuteMC · All Rights Reserved</span>
            <span>·</span>
            <span className="font-semibold text-zinc-300">Made with ❤️ in Vietnam</span>
          </div>
        </div>

        {/* Right Side: Sleek & Compact Donate Box */}
        <div className="md:w-80 p-3 rounded-xl border border-zinc-800 bg-zinc-950/70 flex items-center gap-3.5 shrink-0 shadow-inner">
          <div className="p-1 bg-white rounded-lg shadow-md shrink-0 transition-transform hover:scale-105">
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
