import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import AudioControls from "@/components/AudioControls";

export const metadata: Metadata = {
  title: "流浪者之憩 · AI 奇幻酒馆 Galgame",
  description: "沉浸式暗色奇幻酒馆 × 二次元 Galgame 跑团舞台，支持原创角色立绘表情差分与自由剧本创作。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-[#0B1020] text-[#F1E5CE] flex flex-col selection:bg-[#E6A85C]/30 selection:text-[#FFD485]">
        {/* 顶部 Galgame 沉浸式导航栏 */}
        <header className="app-header sticky top-0 z-50 px-4 py-2.5 flex items-center justify-between bg-[#0B1020]/80 backdrop-blur-md border-b border-[#E6A85C]/25 shadow-lg">
          <Link
            href="/"
            className="app-brand flex items-center gap-2.5 group transition-transform duration-200 hover:scale-[1.02]"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E6A85C] to-[#3B182B] flex items-center justify-center shadow-md border border-[#FFD485]/40 text-base">
              🍷
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold font-serif-title text-[#FFD485] group-hover:text-white transition-colors tracking-wide leading-none">
                流浪者之憩
              </span>
              <span className="text-[10px] text-[#8296D8] font-cinzel tracking-widest leading-none mt-1">
                WANDERER&apos;S REST · TTRPG
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium">
              <Link
                href="/"
                aria-label="酒馆大厅"
                className="px-3 py-1.5 rounded-lg text-[#F1E5CE]/80 hover:text-[#FFD485] hover:bg-[#151D30] transition-all flex items-center gap-1.5"
              >
                <span>🏰</span>
                <span className="hidden sm:inline">酒馆大厅</span>
              </Link>
              <Link
                href="/game"
                aria-label="跑团舞台"
                className="px-3 py-1.5 rounded-lg text-[#F1E5CE]/80 hover:text-[#FFD485] hover:bg-[#151D30] transition-all flex items-center gap-1.5"
              >
                <span>🎲</span>
                <span className="hidden sm:inline">跑团舞台</span>
              </Link>
              <Link
                href="/character"
                aria-label="角色档案"
                className="px-3 py-1.5 rounded-lg text-[#F1E5CE]/80 hover:text-[#FFD485] hover:bg-[#151D30] transition-all flex items-center gap-1.5"
              >
                <span>👤</span>
                <span className="hidden sm:inline">角色档案</span>
              </Link>
              <Link
                href="/scripts"
                aria-label="剧本工坊"
                className="px-3 py-1.5 rounded-lg text-[#F1E5CE]/80 hover:text-[#FFD485] hover:bg-[#151D30] transition-all flex items-center gap-1.5"
              >
                <span>📜</span>
                <span className="hidden sm:inline">剧本工坊</span>
              </Link>
            </nav>

            <div className="h-5 w-[1px] bg-[#8296D8]/20 hidden sm:block" />

            {/* 吟游诗人 BGM 与音效控制 */}
            <AudioControls />
          </div>
        </header>

        {/* 页面内容区 */}
        <main className="flex-1 flex flex-col relative">{children}</main>
      </body>
    </html>
  );
}
