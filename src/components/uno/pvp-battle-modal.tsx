'use client'

import { Keyboard, MousePointerClick, Swords } from 'lucide-react'

import type { BattlePhase } from '@/lib/uno/types'

const BATTLE_MS = 3000

export function PvpBattleModal({
  open,
  phase,
  msLeft,
  myScore,
  oppScore,
  myName,
  oppName,
  winner,
  onMash,
}: {
  open: boolean
  phase: BattlePhase
  msLeft: number
  myScore: number
  oppScore: number
  myName: string
  oppName: string
  /** hook maps the seat-based winner to 'you' / 'opp' */
  winner: 'you' | 'opp' | 'tie' | null
  onMash: () => void
}) {
  if (!open) return null

  const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000))
  const barPct = Math.min(100, Math.max(0, (msLeft / BATTLE_MS) * 100))
  const canMash = phase === 'mash'

  const resultTitle =
    winner === 'you'
      ? 'YOU WIN THE BATTLE!'
      : winner === 'opp'
        ? `${oppName} WINS THE BATTLE!`
        : "IT'S A TIE!"
  const resultSubtitle = winner === 'tie' ? 'Both players draw 2!' : 'Loser draws 4!'
  const resultColor =
    winner === 'you' ? '#22c55e' : winner === 'opp' ? '#ff3b30' : '#ff9500'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sudden card battle"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-xl border-[6px] border-black bg-[#fffdf5] p-4 shadow-[8px_8px_0_#0a0a0a] sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border-[3px] border-black bg-[#ff3b30] text-[#fffdf5] sm:size-10">
            <Swords className="size-5 sm:size-6" strokeWidth={2.5} />
          </span>
          <h2 className="font-display text-xl sm:text-2xl">SUDDEN CARD BATTLE!</h2>
        </div>

        {/* Score panels */}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
          <div className="rounded-lg border-[4px] border-black bg-white p-2 text-center shadow-[4px_4px_0_#0a0a0a] sm:p-3">
            <div className="flex flex-wrap items-center justify-center gap-1">
              <span className="font-display inline-block rounded-md border-[3px] border-black bg-[#22c55e] px-2 py-0.5 text-[10px] sm:text-xs">
                YOU
              </span>
              <span className="text-[10px] font-black text-black/60">({myName})</span>
            </div>
            <p
              key={myScore}
              className="animate-pop-score font-display mt-1 text-6xl leading-none sm:text-7xl"
            >
              {myScore}
            </p>
          </div>
          <div className="flex items-center">
            <span className="font-display rounded-md border-[3px] border-black bg-[#0a0a0a] px-2 py-1 text-xs text-[#ffea00]">
              VS
            </span>
          </div>
          <div className="rounded-lg border-[4px] border-black bg-white p-2 text-center shadow-[4px_4px_0_#0a0a0a] sm:p-3">
            <span className="font-display inline-block max-w-full truncate rounded-md border-[3px] border-black bg-[#ff3b30] px-2 py-0.5 text-[10px] text-black sm:text-xs">
              ({oppName})
            </span>
            <p
              key={oppScore}
              className="animate-pop-score font-display mt-1 text-6xl leading-none sm:text-7xl"
            >
              {oppScore}
            </p>
          </div>
        </div>

        {/* Status area: countdown / ready / result (fixed height so it never jumps) */}
        <div className="mt-4 flex min-h-[120px] flex-col justify-center sm:min-h-[140px]">
          {phase === 'ready' && (
            <p className="font-display animate-pulse text-center text-2xl sm:text-3xl">
              GET READY…
            </p>
          )}
          {phase === 'mash' && (
            <div className="text-center">
              <p key={secondsLeft} className="animate-pop font-display text-6xl leading-none sm:text-7xl">
                {secondsLeft}
              </p>
              <div className="mx-auto mt-3 h-5 w-full border-[3px] border-black bg-white">
                <div className="h-full bg-[#ff3b30]" style={{ width: `${barPct}%` }} />
              </div>
            </div>
          )}
          {phase === 'result' && (
            <div role="status" className="text-center">
              <p
                className="animate-pop font-display text-2xl leading-tight sm:text-3xl"
                style={{ color: resultColor }}
              >
                {resultTitle}
              </p>
              <p className="mt-2 text-sm font-bold">{resultSubtitle}</p>
            </div>
          )}
        </div>

        {/* Mash button — pointerdown ONLY so global SPACE handling can't double-fire */}
        <button
          type="button"
          aria-label="Mash battle button"
          disabled={!canMash}
          onPointerDown={onMash}
          onContextMenu={(e) => e.preventDefault()}
          className={`font-display mt-1 flex w-full select-none touch-none items-center justify-center gap-3 rounded-lg border-[5px] border-black py-5 text-3xl transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 sm:py-6 sm:text-4xl ${
            canMash
              ? 'cursor-pointer bg-[#ffea00] text-black shadow-[6px_6px_0_#0a0a0a] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#0a0a0a] active:translate-x-1 active:translate-y-1 active:shadow-none'
              : 'cursor-not-allowed bg-[#e5e7eb] text-black/50 shadow-none'
          }`}
        >
          <MousePointerClick className="size-7 sm:size-8" strokeWidth={2.5} />
          MASH!
        </button>

        <p className="mt-3 flex items-center justify-center gap-2 text-xs font-bold">
          <Keyboard className="size-4 shrink-0" strokeWidth={2.5} />
          TAP THE BUTTON OR SMASH SPACE
        </p>
      </div>
    </div>
  )
}
