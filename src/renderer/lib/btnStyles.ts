// Inline button class constants — dùng trực tiếp, không cần import component
// Primary (Emerald Green)
// <button className={BTN.primary}>...</button>
// <button className={`${BTN.primary} ${BTN.sm}`}>...</button>

export const BTN_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"

export const BTN = {
  primary:  `${BTN_BASE} rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 text-sm px-4 h-9 shadow-sm shadow-emerald-500/20`,
  secondary:`${BTN_BASE} rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 text-sm px-4 h-9`,
  outline:  `${BTN_BASE} rounded-xl border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800 text-sm px-4 h-9`,
  ghost:    `${BTN_BASE} rounded-xl bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 text-sm px-4 h-9`,
  danger:   `${BTN_BASE} rounded-xl bg-red-600 text-white hover:bg-red-500 text-sm px-4 h-9`,
  // Sizes (append after variant)
  sm:       "!h-8 !px-3 !text-xs !rounded-lg",
  lg:       "!h-11 !px-6 !text-base",
  iconSm:   "!size-8 !p-0 !rounded-lg",
  icon:     "!size-9 !p-0",
  // Full width helper
  full:     "w-full",
}
