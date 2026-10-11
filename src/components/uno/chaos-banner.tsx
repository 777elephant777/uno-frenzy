'use client'

import { Zap } from 'lucide-react'

import type { ChaosBannerInfo } from '@/lib/uno/types'

export function ChaosBanner({ info }: { info: ChaosBannerInfo | null }) {
  if (!info) return null

  return (
    <div className="pointer-events-none fixed left-1/2 top-24 z-[70] -translate-x-1/2">
      <div
        key={info.id}
        role="status"
        aria-live="polite"
        className="animate-banner -rotate-2 w-[92vw] max-w-md rounded-xl border-4 border-[#ffea00] bg-[#0a0a0a] px-4 py-3 text-center shadow-[8px_8px_0_rgba(0,0,0,0.35)] sm:px-6 sm:py-4"
      >
        <p className="font-display flex items-center justify-center gap-1.5 text-xs tracking-[0.3em] text-[#ff9500]">
          <Zap className="size-4 shrink-0" strokeWidth={2.5} />
          CHAOS EVENT!
        </p>
        <p className="font-display mt-1 text-2xl leading-tight text-[#ffea00] sm:text-4xl">
          {info.name}
        </p>
        <p className="mt-1 text-sm font-bold text-[#fffdf5]">{info.description}</p>
      </div>
    </div>
  )
}
