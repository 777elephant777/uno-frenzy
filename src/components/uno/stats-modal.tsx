'use client'

import { useState } from 'react'
import { BarChart3, RotateCcw, Trash2, Users, X } from 'lucide-react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PvpStats } from '@/lib/uno/stats'
import type { CareerStats } from '@/lib/uno/types'

export function StatsModal({
  open,
  onOpenChange,
  stats,
  pvpStats,
  onReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stats: CareerStats
  pvpStats: PvpStats
  onReset: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  // Disarm the two-step confirm whenever the modal closes.
  const handleOpenChange = (next: boolean) => {
    if (!next) setConfirming(false)
    onOpenChange(next)
  }

  const games = stats.wins + stats.losses
  const winRate = games > 0 ? `${Math.round((stats.wins / games) * 100)}%` : '—'
  const pvpGames = pvpStats.wins + pvpStats.losses
  const pvpWinRate = pvpGames > 0 ? `${Math.round((pvpStats.wins / pvpGames) * 100)}%` : '—'

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    onReset()
  }

  const blocks: Array<{ label: string; value: string | number; bg: string }> = [
    { label: 'WINS', value: stats.wins, bg: '#22c55e' },
    { label: 'LOSSES', value: stats.losses, bg: '#ff3b30' },
    { label: 'CURRENT STREAK', value: stats.currentStreak, bg: '#ffffff' },
    { label: 'BEST STREAK', value: stats.bestStreak, bg: '#ffffff' },
    { label: 'BATTLES WON', value: stats.battlesWon, bg: '#ff9500' },
    { label: 'WIN RATE', value: winRate, bg: '#ffea00' },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[92vw] gap-0 rounded-xl border-[5px] border-black bg-[#fffdf5] p-0 shadow-[8px_8px_0_#0a0a0a] sm:max-w-lg"
      >
        <div className="flex items-center gap-3 border-b-[5px] border-black bg-[#ffea00] p-4 pr-16 sm:p-5 sm:pr-20">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border-[3px] border-black bg-[#0a0a0a] text-[#ffea00] sm:size-11">
            <BarChart3 className="size-5 sm:size-6" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl leading-none sm:text-2xl">
              CAREER STATS
            </DialogTitle>
            <DialogDescription className="mt-1 text-[11px] font-bold sm:text-xs">
              Your lifelong war record — CPU and online PvP.
            </DialogDescription>
          </div>
        </div>

        <DialogClose
          aria-label="Close career stats"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-md border-[3px] border-black bg-[#ffea00] text-black shadow-[3px_3px_0_#0a0a0a] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#0a0a0a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <X className="size-5" strokeWidth={2.5} />
        </DialogClose>

        <div className="brutal-scroll max-h-[70vh] overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {blocks.map((block) => (
              <div
                key={block.label}
                className="rounded-lg border-[4px] border-black p-3 text-center shadow-[4px_4px_0_#0a0a0a]"
                style={{ backgroundColor: block.bg }}
              >
                <p className="font-display text-[10px] tracking-widest sm:text-xs">
                  {block.label}
                </p>
                <p className="font-display mt-1 text-3xl leading-none sm:text-4xl">
                  {block.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2 border-b-[3px] border-black/15 pb-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border-[3px] border-black bg-[#ffd600]">
                <Users className="size-4" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-sm leading-none">PVP RECORD</h3>
                <p className="text-[10px] font-bold text-black/60">
                  Online matches against other players.
                </p>
              </div>
              <span className="font-display ml-auto rounded-md border-[3px] border-black bg-white px-2 py-0.5 text-[10px] shadow-[2px_2px_0_#0a0a0a]">
                {pvpWinRate} WIN RATE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border-[4px] border-black bg-[#ffd600] p-3 text-center shadow-[4px_4px_0_#0a0a0a]">
                <p className="font-display text-[10px] tracking-widest sm:text-xs">PVP WINS</p>
                <p className="font-display mt-1 text-3xl leading-none sm:text-4xl">{pvpStats.wins}</p>
              </div>
              <div className="rounded-lg border-[4px] border-black bg-[#ff9500] p-3 text-center shadow-[4px_4px_0_#0a0a0a]">
                <p className="font-display text-[10px] tracking-widest sm:text-xs">PVP LOSSES</p>
                <p className="font-display mt-1 text-3xl leading-none sm:text-4xl">{pvpStats.losses}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={handleReset}
              className={`font-display flex w-full items-center justify-center gap-2 rounded-lg border-[4px] border-black px-4 py-3 text-lg shadow-[4px_4px_0_#0a0a0a] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                confirming
                  ? 'animate-pulse bg-[#ff3b30] text-black'
                  : 'bg-[#0a0a0a] text-[#ffea00]'
              }`}
            >
              {confirming ? (
                <Trash2 className="size-5" strokeWidth={2.5} />
              ) : (
                <RotateCcw className="size-5" strokeWidth={2.5} />
              )}
              {confirming ? 'SURE?' : 'RESET STATS'}
            </button>
            {confirming && (
              <p className="text-center text-xs font-bold text-[#ff3b30]">
                Click again to wipe BOTH records. No takebacks.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
