import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Code2, HelpCircle, Heart } from 'lucide-react'
import { Button } from '../components/ui/button'
import logoImg from '../assets/avatarv2-modified.png'
import qrDonateImg from '../assets/qr_donate.png'
import pkg from '../../../package.json'

export function AboutScreen() {

  return (
    <div className="px-5 py-3 max-w-4xl mx-auto flex flex-col gap-3">
      {/* Header - Make it more compact */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground/80">Giới thiệu & Ủng hộ</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Thông tin về LetCuteMC Launcher và đóng góp phát triển</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Column: Launcher Info & Developer combined into one card */}
        <div className="md:col-span-2 space-y-4">
          <Card className="relative overflow-hidden h-full flex flex-col">
            {/* Ambient background glow */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <CardHeader className="py-2.5">
              <CardTitle className="flex items-center gap-2 text-foreground text-sm font-semibold">
                <Code2 className="h-4 w-4 text-primary" />
                LetCuteMC Launcher
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 text-xs text-muted-foreground leading-relaxed py-2.5 flex flex-col justify-between">
              <div>
                <p>
                  <strong className="text-foreground font-semibold">LetCuteMC</strong> là một Minecraft Launcher thế hệ mới, được thiết kế tối giản, hiện đại và tối ưu hiệu suất cực cao cho game thủ. Launcher được xây dựng trên nền tảng <strong className="text-foreground">Electron</strong> kết hợp với giao diện <strong className="text-foreground">React + TailwindCSS</strong> và lõi xử lý game mạnh mẽ từ <strong className="text-foreground">XMCL</strong>.
                </p>

                <div className="space-y-1.5 mt-3">
                  <h4 className="font-semibold text-foreground text-[10px] uppercase tracking-wider">Các tính năng nổi bật:</h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      Quét & tự động tải Java tương thích
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      Cài đặt Mods/Modpacks từ Modrinth
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      Quản lý Mods, Shaders & Resources
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      Tối ưu hiệu năng & Launch Boost
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      Hỗ trợ tài khoản Microsoft & Offline
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      Hỗ trợ Forge / NeoForge / Fabric / Quilt
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between gap-4">
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
                <span>Phiên bản: <strong className="text-foreground font-medium">{pkg.version} </strong></span>
                <span>Bản quyền © 2026 LetCute</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Donate Card */}
        <div className="md:col-span-1">
          <Card className="relative overflow-hidden h-full border-primary/20 hover:border-primary/40 transition-colors duration-300">
            <CardHeader className="py-3 pb-1 text-center">
              <CardTitle className="flex justify-center items-center gap-1.5 text-foreground text-sm font-bold">
                <Heart className="h-4 w-4 text-red-400 fill-red-400/20 animate-pulse" />
                Ủng hộ dự án
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-4 pt-2 space-y-3">
              <p className="text-[11px] text-muted-foreground text-center px-2">
                Nếu bạn thấy Launcher hữu ích, hãy cân nhắc donate để tiếp thêm động lực cho LetCute nhé! 💖
              </p>

              <div className="relative p-2 bg-white rounded-xl shadow-lg group">
                <img
                  src={qrDonateImg}
                  alt="QR Donate"
                  className="w-32 h-32 object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              <div className="text-center space-y-0.5 mt-1">
                <p className="text-xs font-semibold text-foreground">Momo / VNPay / Bank</p>
                <p className="text-[10px] text-muted-foreground">Quét mã QR để ủng hộ</p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
export default AboutScreen
