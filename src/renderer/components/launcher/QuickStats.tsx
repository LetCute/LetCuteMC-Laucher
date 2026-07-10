import { Layers, Box, PackageOpen, Globe } from 'lucide-react'

interface QuickStatsProps {
  stats: {
    versions: number
    mods: number
    resourcePacks: number
    saves: number
  }
}

const statItems = [
  { key: 'versions' as const, label: 'Phiên bản', icon: Globe, color: 'text-cyan-300', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  { key: 'mods' as const, label: 'Mods', icon: Box, color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { key: 'resourcePacks' as const, label: 'Resource Packs', icon: PackageOpen, color: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20' },
  { key: 'saves' as const, label: 'Saves', icon: Layers, color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
]

export function QuickStats({ stats }: QuickStatsProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Thư viện
      </h3>

      <div className="grid grid-cols-2 gap-2.5">
        {statItems.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.key}
              className={`rounded-xl border ${item.bg} p-3.5`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`h-4 w-4 ${item.color}`} strokeWidth={2} />
              </div>
              <p className={`text-2xl font-bold ${item.color}`}>{stats[item.key]}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
