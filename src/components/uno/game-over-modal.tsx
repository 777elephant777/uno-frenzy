'use client'

import { Play, Skull, Trophy } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DIFFICULTY_LABELS, type CareerStats, type Difficulty } from '@/lib/uno/types'

export function GameOverModal({
  open,
  winner,
  stats,
  difficulty,
  onPlayAgain,
}: {
  open: boolean
  winner: 'player' | 'ai'
  stats: CareerStats
  difficulty: Difficulty
  onPlayAgain: () => void
}) {
  const isPlayerWin = winner === 'player'

  const chips: Array<{ label: string; value: number }> = [
    { label: 'WINS', value: stats.wins },
    { label: 'LOSSES', value: stats.losses },
    { label: 'STREAK', value: stats.currentStreak },
    { label: 'BEST', value: stats.bestStreak },
    { label: 'BATTLES WON', value: stats.battlesWon },
  ]

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="brutal-scroll max-h-[70vh] max-w-[92vw] gap-3 overflow-y-auto rounded-xl border-[5px] border-black bg-[#fffdf5] p-5 text-center shadow-[8px_8px_0_#0a0a0a] sm:max-w-md sm:p-7"
      >
        <div
          className="mx-auto flex size-24 items-center justify-center rounded-xl border-[5px] border-black shadow-[6px_6px_0_#0a0a0a] sm:size-28"
          style={{ backgroundColor: isPlayerWin ? '#22c55e' : '#ff3b30' }}
        >
          {isPlayerWin ? (
            <Trophy className="size-12 text-black sm:size-14" strokeWidth={2.5} />
          ) : (
            <Skull className="size-12 text-[#fffdf5] sm:size-14" strokeWidth={2.5} />
          )}
        </div>

        <DialogTitle
          className={`font-display mt-3 text-4xl leading-none sm:text-5xl ${
            isPlayerWin ? 'text-[#22c55e]' : 'text-[#ff3b30]'
          }`}
        >
          {isPlayerWin ? 'YOU WIN!' : 'YOU LOSE...'}
        </DialogTitle>

        <DialogDescription className="text-sm font-bold">
          {isPlayerWin
            ? 'You emptied your hand first. The CPU is in shambles.'
            : 'The CPU emptied its hand first. Tragic.'}
        </DialogDescription>

        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-xs font-bold">DIFFICULTY:</span>
          <span className="font-display rounded-md border-[3px] border-black bg-[#0a0a0a] px-2.5 py-1 text-xs text-[#ffea00]">
            {DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="font-display inline-flex items-center gap-1.5 rounded-md border-[3px] border-black bg-white px-2.5 py-1 text-[10px] tracking-wider sm:text-xs"
            >
              {chip.label}
              <span className="text-sm sm:text-base">{chip.value}</span>
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onPlayAgain}
          aria-label="Play again"
          className="font-display mt-4 flex w-full items-center justify-center gap-3 rounded-lg border-[5px] border-black bg-[#ffea00] px-6 py-4 text-2xl text-black shadow-[6px_6px_0_#0a0a0a] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#0a0a0a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:py-5 sm:text-3xl"
        >
          <Play className="size-7 sm:size-8" strokeWidth={2.5} />
          PLAY AGAIN
        </button>
      </DialogContent>
    </Dialog>
  )
}
