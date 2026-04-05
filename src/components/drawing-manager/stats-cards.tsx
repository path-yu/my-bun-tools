'use client'

import { FileText, Layers, Package, Gauge } from 'lucide-react'

interface StatsCardsProps {
  totalDrawings: number
  stainlessCount: number
  carbonCount: number
  vacuumCount: number
}

export function StatsCards({ totalDrawings, stainlessCount, carbonCount, vacuumCount }: StatsCardsProps) {
  const stats = [
    {
      label: '总图纸数',
      value: totalDrawings,
      icon: FileText,
      color: 'bg-primary/15 text-primary',
    },
    {
      label: '不锈钢',
      value: stainlessCount,
      icon: Layers,
      color: 'bg-blue-500/15 text-blue-400',
    },
    {
      label: '碳钢',
      value: carbonCount,
      icon: Package,
      color: 'bg-orange-500/15 text-orange-400',
    },
    {
      label: '真空罐',
      value: vacuumCount,
      icon: Gauge,
      color: 'bg-emerald-500/15 text-emerald-400',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm"
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
            <stat.icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
