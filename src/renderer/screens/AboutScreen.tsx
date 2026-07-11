import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Heart, Code2, Check, Copy, HelpCircle, HeartHandshake } from 'lucide-react'
import { Button } from '../components/ui/button'
import logoImg from '../assets/avatarv2-modified.png'

export function AboutScreen() {
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const donateAccounts = [
    {
      method: "Ngân hàng ACB",
      account: "5173331",
      name: "PHAM THAI NGUYEN",
    }
  ]

  return (
    < div className="px-5 py-3 max-w-4xl mx-auto flex flex-col gap-3" >
      {/* Header - Make it more compact */}
      < div className="flex items-center justify-between" >
        <div>
          <h2 className="text-lg font-bold text-foreground">Giới thiệu & Ủng hộ</h2>
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

        {/* Right Column: Donate & Support */}
        <div className="space-y-4">
          <Card className="relative overflow-hidden border-rose-500/20 bg-rose-950/5">
            {/* Soft pink glow */}
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

            <CardHeader className="py-2">
              <CardTitle className="flex items-center gap-2 text-rose-300 text-sm font-semibold">
                <Heart className="h-4 w-4 text-rose-500 fill-rose-500 animate-pulse" />
                Ủng hộ tác giả
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs text-muted-foreground py-3">


              {/* Copyable Details */}
              <div className="w-full space-y-2">
                {donateAccounts.map((acc, index) => (
                  <div key={index} className="p-3.5 rounded-xl border border-border/85 bg-background flex items-center justify-between text-[11px] gap-4 shadow-sm hover:bg-background/70 transition-colors">
                    {/* Left: SVG logo of ACB */}
                    <div className="w-16 shrink-0 select-none bg-white p-1.5 rounded-lg flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 277.38 150.93" className="w-full h-auto object-contain">
                        <title>ACB logo</title>
                        <path d="M436.1,511.41l-12.52-39.28-13.21,39.28Zm-22.23-62.49h20.85c1.38,0,2.76,1.44,3.45,2.13L475,552.19a1.83,1.83,0,0,1-2.07,2.07H452.07a3.87,3.87,0,0,1-3.5-2.07l-7-21.77H404.85l-6.95,21.77a3.87,3.87,0,0,1-3.5,2.07H375c-1.38,0-2.13-.69-1.38-2.07L410.37,451C411.06,450.36,412.49,448.92,413.87,448.92Z" transform="translate(-373.31 -436.54)" style={{ fill: '#00388c' }} />
                        <path d="M609,536a19.26,19.26,0,0,0,6.26-.69c2.12,0,3.5-.69,5.58-1.38,1.38-1.43,3.43-2.13,4.18-4.25a12.64,12.64,0,0,0,2.08-7.7,11.89,11.89,0,0,0-2.08-7,12.71,12.71,0,0,0-4.18-4.25,13.08,13.08,0,0,0-5.58-1.38,19.28,19.28,0,0,0-6.26-.69H593.71V536Zm-1.38-44.91a15.23,15.23,0,0,0,5.56-.69,7.77,7.77,0,0,0,4.88-2.12,15.58,15.58,0,0,0,2.78-3.5,12.19,12.19,0,0,0,0-11.26,8.52,8.52,0,0,0-3.45-3.5c-1.45-1.38-2.82-1.38-4.2-2.12-2.05,0-3.43-.69-5.56-.69H593.71v23.89Zm-34-42.15h36.81c6.21,0,11.79.69,16,2.13a24.17,24.17,0,0,1,11.09,6.32c2.82,2.12,4.88,5.63,6.26,8.44,1.38,3.5,1.38,7,1.38,10.51s0,6.32-1.38,9.13a22.87,22.87,0,0,1-4.18,6.32c-2.08,2.12-3.45,3.5-5.51,4.19a6,6,0,0,1-4.2,2.12c1.38.69,4.2,1.44,6.26,2.81a14.67,14.67,0,0,1,7,4.19,34.2,34.2,0,0,1,5.58,7.75,29.56,29.56,0,0,1,2.05,11.26c0,5.57-.68,9.82-2.75,14-2.12,3.5-4.2,7-8.38,9.13-3.45,2.81-7.63,4.19-12.47,5.63a116.83,116.83,0,0,1-16.67,1.38H573.61a3,3,0,0,1-2.82-2.81v-99.7A3.08,3.08,0,0,1,573.61,448.92Z" transform="translate(-373.31 -436.54)" style={{ fill: '#00388c' }} />
                        <path d="M527.77,520.54a19,19,0,0,1,0-37.9c9.71,0,18,8.44,18,19S537.48,520.54,527.77,520.54Z" transform="translate(-373.31 -436.54)" style={{ fill: '#009ee0' }} />
                        <path d="M547.88,526.17a29.74,29.74,0,0,1-20.79,9.13c-18.09,0-31.94-15.45-31.94-33.71s13.84-33,31.94-33a31.51,31.51,0,0,1,20.79,7.7c.75,1.38,2.13,1.38,3.5,0l11.09-11.26a3.23,3.23,0,0,0,0-3.5A52.17,52.17,0,0,0,525,446.11c-29.81,0-54.17,25.27-54.17,55.48,0,30.9,24.35,55.48,54.17,55.48a56.87,56.87,0,0,0,38.2-15.45,4.2,4.2,0,0,0,0-4.19l-11.09-11.26A4.51,4.51,0,0,0,547.88,526.17Z" transform="translate(-373.31 -436.54)" style={{ fill: '#00388c' }} />
                      </svg>
                    </div>

                    {/* Right: Details & Copy */}
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="font-bold text-foreground text-[11px] leading-tight">{acc.method}</p>
                      <p className="font-mono text-xs font-semibold text-primary mt-1 leading-none">{acc.account}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">Chủ TK: <span className="text-foreground font-medium">{acc.name}</span></p>
                    </div>

                    <button
                      onClick={() => handleCopy(acc.account, acc.method)}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-accent/40 transition-colors shrink-0"
                      title="Sao chép số tài khoản"
                    >
                      {copiedText === acc.method ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>


            </CardContent>
          </Card>
        </div>

      </div>
    </div >
  )
}
export default AboutScreen
