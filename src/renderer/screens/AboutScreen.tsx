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
  Boxes,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { ScreenHeader } from '../components/common/ScreenHeader'
import pkg from '../../../package.json'
import { cn } from '@/lib/utils'

interface FeatureItem {
  id: string
  category: 'engine' | 'management' | 'studio'
  title: string
  tagline: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
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
    badge: 'Kho Mod',
    highlights: ['Cài modpack 1-click', 'Tự tải kèm phụ thuộc', 'Tìm kiếm & lọc nhanh'],
  },
  {
    id: 'java',
    category: 'engine',
    title: 'Tự động cài Java',
    tagline: 'Tự phát hiện và tải Java chuẩn',
    description: 'Tự tìm và tải phiên bản Java tương thích nhất, không cần cài đặt thủ công.',
    icon: Cpu,
    badge: 'Tự Động',
    highlights: ['OpenJDK chính thức', 'Quét Java trên máy', 'Khắc phục lỗi Java'],
  },
  {
    id: 'optimizer',
    category: 'engine',
    title: 'Tối ưu hóa & Tăng FPS',
    tagline: 'Bộ cờ mượt mà và dọn rác',
    description: 'Tối ưu bộ nhớ RAM, ép dùng card đồ họa rời giúp game chạy mượt và ổn định.',
    icon: Sliders,
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
    badge: 'Chống Crash',
    highlights: ['Phát hiện mod xung đột', 'Báo sai phiên bản', 'Sửa lỗi 1-click'],
  },
  {
    id: 'share_backup',
    category: 'management',
    title: 'Sao lưu & Chia sẻ',
    tagline: 'Gửi gói game cho bạn bè qua 1 file',
    description: 'Đóng gói mod, phím bấm và cài đặt để chia sẻ hoặc khôi phục nhanh chóng.',
    icon: FolderArchive,
    badge: 'Chia Sẻ',
    highlights: ['Gửi mod cho bạn bè', 'Giữ nguyên cài đặt', 'Khôi phục tức thì'],
  },
  {
    id: 'skin_cape',
    category: 'studio',
    title: 'Kho Skin 3D',
    tagline: 'Đổi skin và xem trước chuyển động 3D',
    description: 'Xem trước trang phục nhân vật 360 độ và kho 400+ skin đẹp có sẵn.',
    icon: Shirt,
    badge: 'Skin 3D',
    highlights: ['Xem trước 3D trực quan', 'Kho 400+ skin sẵn', 'Hỗ trợ tay nhỏ & to'],
  },
  {
    id: 'accounts',
    category: 'studio',
    title: 'Quản lý tài khoản',
    tagline: 'Hỗ trợ Microsoft & Offline',
    description: 'Lưu nhiều tài khoản và chuyển đổi qua lại nhanh chóng chỉ với 1 click.',
    icon: UserCheck,
    badge: 'Tài Khoản',
    highlights: ['Đăng nhập Microsoft', 'Tài khoản Offline', 'Đổi tài khoản 1-click'],
  },
]

const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'engine', label: 'Hiệu năng & Lõi' },
  { id: 'management', label: 'Quản lý Mod' },
  { id: 'studio', label: 'Tiện ích & Skin' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

export function AboutScreen() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')

  const filteredFeatures =
    activeCategory === 'all'
      ? FEATURE_LIST
      : FEATURE_LIST.filter((f) => f.category === activeCategory)

  return (
    <div className="px-6 pt-2 pb-6 max-w-6xl mx-auto flex flex-col gap-5 select-none">
      {/* Screen Header đồng bộ chuẩn launcher */}
      <ScreenHeader
        title="Giới thiệu"
        subtitle={
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span>LetCuteMC Launcher v{pkg.version}</span>
            <span>·</span>
            <span>Nền tảng khởi chạy Minecraft tối ưu</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="elevated"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5"
              onClick={() => window.launcherApi?.openExternal?.('https://discord.gg/rRZujVzPRx')}
            >
              <HelpCircle size={14} className="text-primary" />
              <span>Discord hỗ trợ</span>
            </Button>
            <Button
              variant="elevated"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5"
              onClick={() => window.launcherApi?.openExternal?.('https://letcute.com')}
            >
              <Globe size={14} className="text-primary" />
              <span>Trang chủ</span>
            </Button>
          </div>
        }
      />

      {/* Hero Overview Card */}
      <Card className="border-zinc-800/60 bg-zinc-950/45 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-md bg-zinc-900 border border-zinc-800/80 flex items-center justify-center p-2.5 shrink-0 shadow-inner">
              <img
                src="./logo.png"
                alt="LetCuteMC Logo"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-foreground tracking-tight">LetCuteMC Launcher</h3>
                <Badge variant="primary" className="text-[11px] font-mono">
                  v{pkg.version}
                </Badge>
                <Badge variant="success" className="text-[10px]">
                  Miễn phí
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Minecraft Launcher nhẹ mượt: Khởi động nhanh, tối ưu FPS, tải Modrinth trực tiếp, quản lý skin 3D và tự động chẩn đoán lỗi game.
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack Badges */}
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span className="font-medium text-zinc-400">Nền tảng:</span>
          <Badge variant="outline" className="text-zinc-300">Electron</Badge>
          <Badge variant="outline" className="text-cyan-400">React & Vite</Badge>
          <Badge variant="outline" className="text-primary">XMCL Core</Badge>
          <Badge variant="outline" className="text-emerald-400">OpenJDK Temurin</Badge>
        </div>
      </Card>

      {/* Main Feature Showcase Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-foreground">Tính năng nổi bật ({FEATURE_LIST.length})</h3>
            <p className="text-xs text-muted-foreground">Các công cụ và tiện ích tích hợp sẵn trong LetCuteMC</p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id
              const count = cat.id === 'all' ? FEATURE_LIST.length : FEATURE_LIST.filter((f) => f.category === cat.id).length
              return (
                <Button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  variant={isSelected ? 'primary' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-8 px-3 rounded-md text-xs font-semibold transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/20'
                      : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  )}
                >
                  {cat.label}
                  <span
                    className={cn(
                      'ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                      isSelected
                        ? 'bg-zinc-950/40 text-primary-foreground'
                        : 'bg-zinc-800 text-zinc-400'
                    )}
                  >
                    {count}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFeatures.map((item) => {
            const Icon = item.icon
            return (
              <Card
                key={item.id}
                className="border-zinc-800/60 bg-zinc-950/45 hover:border-zinc-700/80 hover:bg-zinc-900/40 p-3.5 transition-all duration-150 shadow-xs flex flex-col justify-between gap-3 group"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-10 w-10 rounded-lg border border-primary/25 bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105 shadow-xs">
                      <Icon size={18} />
                    </div>
                    <Badge variant="secondary" className="text-[10px] text-zinc-400 border-zinc-800">
                      {item.badge}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] font-medium text-primary/80 mt-0.5">
                      {item.tagline}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap gap-1.5">
                  {item.highlights.map((h, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900/80 border-zinc-800/80 text-zinc-400 font-normal"
                    >
                      {h}
                    </Badge>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Developer & Donate Unified Footer Card */}
      <Card className="border-zinc-800/60 bg-zinc-950/45 p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column: Developer Info */}
          <div className="lg:col-span-7 flex items-start gap-4">
            <img
              src="./assets/avatarv2-modified.png"
              alt="LetCute Avatar"
              loading="lazy"
              decoding="async"
              className="h-12 w-12 rounded-lg object-contain border border-primary/30 p-1 bg-zinc-900/90 shrink-0 shadow-xs"
            />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-foreground">Phát triển bởi LetCute</h4>
                <Badge variant="primary" className="text-[10px]">
                  Lead Developer
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tâm huyết xây dựng nền tảng Minecraft Launcher tối ưu, miễn phí và hiện đại nhất cho cộng đồng game thủ Việt Nam.
              </p>
            </div>
          </div>

          {/* Right Column: Sleek Donation Box */}
          <div className="lg:col-span-5 flex items-center gap-3.5 p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/50 shadow-xs">
            <div className="p-1 bg-white rounded-md shrink-0 shadow-sm transition-transform hover:scale-105">
              <img
                src="./assets/qr_donate.png"
                alt="QR Donate"
                className="h-16 w-16 object-contain rounded"
              />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Heart size={13} className="text-red-400 fill-red-400/20 animate-pulse" />
                <span>Ủng Hộ Dự Án</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Quét mã QR tiếp thêm động lực duy trì máy chủ & cập nhật tính năng mới!
              </p>
              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/15 text-pink-300 border-pink-500/25 font-semibold">
                  Momo
                </Badge>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border-blue-500/25 font-semibold">
                  VNPay
                </Badge>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border-emerald-500/25 font-semibold">
                  Ngân Hàng
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom divider: Copyright & Legal Disclaimer */}
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Bản quyền © 2026 LetCuteMC</span>
            <span>·</span>
            <span className="font-medium text-zinc-300">Made with ❤️ in Vietnam</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">
            * LetCuteMC không liên kết hay được chứng thực bởi Mojang AB hay Microsoft.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default AboutScreen