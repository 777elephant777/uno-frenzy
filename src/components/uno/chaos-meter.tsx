'use client'

import { Zap } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ChaosMeter({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  const hot = pct >= 80
  return (
    <div className="w-full sm:w-56" aria-label={`Chaos frenzy meter at ${pct} percent`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display flex items-center gap-1 text-xs tracking-wider">
          <Zap className="size-4" strokeWidth={2.5} fill="#ff9500" stroke="#0a0a0a" />
          CHAOS FRENZY
        </span>
        <span className="font-display text-xs">{pct}%</span>
      </div>
      <div
        className="mt-1 h-7 overflow-hidden rounded-md border-[4px] border-black bg-white shadow-[4px_4px_0_#0a0a0a]"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full border-r-4 border-black transition-[width] duration-300',
            pct < 50 ? 'bg-[#ffd600]' : pct < 80 ? 'bg-[#ff9500]' : 'bg-[#ff3b30]',
            hot && 'animate-meter-pulse',
          )}
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>
      {hot && (
        <p className="font-display mt-1 animate-pulse text-[10px] tracking-wider text-black">
          CHAOS IMMINENT!
        </p>
      )}
    </div>
  )
}
