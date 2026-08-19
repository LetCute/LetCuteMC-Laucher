import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Code2, HelpCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import logoImg from '../assets/avatarv2-modified.png'

export function AboutScreen() {


  return (
    < div className="px-5 py-3 max-w-4xl mx-auto flex flex-col gap-3" >
      {/* Header - Make it more compact */}
      < div className="flex items-center justify-between" >
        <div>
          <h2 className="text-lg font-bold text-foreground/80">Giới thiệu & Ủng hộ</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Thông tin về LetCuteMC Launcher và đóng góp phát triển</p>
        </div>
      </div >

      <div className="grid grid-cols-1 gap-4">

        {/* Left Column: Launcher Info & Developer combined into one card */}
        <div className="md:col-span-2 space-y-4">
          <Card className="relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <CardHeader className="py-2.5">
              <CardTitle className="flex items-center gap-2 text-foreground text-sm font-semibold">
                <Code2 className="h-4 w-4 text-primary" />
                LetCuteMC Launcher
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed py-2.5">
              <p>
                <strong className="text-foreground font-semibold">LetCuteMC</strong> là một Minecraft Launcher thế hệ mới, được thiết kế tối giản, hiện đại và tối ưu hiệu suất cực cao cho game thủ. Launcher được xây dựng trên nền tảng <strong className="text-foreground">Electron</strong> kết hợp với giao diện <strong className="text-foreground">React + TailwindCSS</strong> và lõi xử lý game mạnh mẽ từ <strong className="text-foreground">XMCL</strong>.
              </p>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-foreground text-[10px] uppercase tracking-wider">Các tính năng nổi bật:</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    Tự động chọn Java tương thích
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    Chế độ Tối ưu hiệu năng tự động
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    Quản lý Mods / Shaders / Resources
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    Launch Boost (Tăng tốc game)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    Tài khoản Microsoft & Local
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    Tải trước thư viện game nền
                  </li>
                </ul>
              </div>

              {/* Dev team row inside the main card to save vertical height */}
              <div className="pt-2.5 border-t border-border/40 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <img
                    src={logoImg}
                    alt="LetCuteMC"
                    className="h-8 w-auto rounded-lg object-contain drop-shadow-md transition-transform duration-300 hover:scale-[1.02]"
                  />
                  <div>
                    <h5 className="font-semibold text-foreground text-[11px] leading-none">LetCute</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Laucher FREE</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-6.5 px-2 gap-1 text-[10px]">
                    <HelpCircle className="h-3 w-3" />
                    Báo lỗi
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t border-border/20 flex items-center justify-between text-[10px] text-muted-foreground/80">
                <span>Phiên bản: <strong className="text-foreground font-medium">1.0.0 (Stable)</strong></span>
                <span>Bản quyền © 2026 LetCute</span>
              </div>
            </CardContent>
          </Card>
        </div>



      </div>
    </div >
  )
}
export default AboutScreen
