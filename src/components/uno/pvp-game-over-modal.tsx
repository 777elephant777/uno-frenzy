'use client'

import { LogOut, RotateCcw, Skull, Trophy } from 'lucide-react'

import type { PvpRoomView } from '@/lib/uno/pvp-protocol'

export function PvpGameOverModal({
  open,
  view,
  onRematch,
  onLeave,
}: {
  open: boolean
  view: PvpRoomView
  onRematch: () => void
  onLeave: () => void
}) {
  if (!open) return null

  const you = view.you
  const opp = you === 0 ? 1 : 0
  const oppName = view.names[opp]
  const iWon = view.gameOver?.winner === you
  const reason = view.gameOver?.reason ?? 'empty-hand'
  const canRematch = view.opponentConnected && view.gameOver?.reason === 'empty-hand'

  const subtitle =
    reason === 'forfeit'
      ? iWon
        ? `${oppName} left the match — VICTORY BY FORFEIT!`
        : 'You left the match.'
      : iWon
        ? 'You emptied your hand first — FRENZY MASTER!'
        : `${oppName} emptied their hand first.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Match result"
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="brutal-scroll animate-pop max-h-[88vh] w-full max-w-[92vw] overflow-y-auto rounded-xl border-[5px] border-black bg-[#fffdf5] p-6 text-center shadow-[8px_8px_0_#0a0a0a] sm:max-w-md">
        {/* Icon tile */}
        <div
          className={`mx-auto flex size-20 items-center justify-center rounded-xl border-[5px] border-black shadow-[5px_5px_0_#0a0a0a] ${
            iWon ? 'bg-[#22c55e]' : 'bg-[#ff3b30]'
          }`}
        >
          {iWon ? (
            <Trophy className="size-10 text-black" strokeWidth={2.5} />
          ) : (
            <Skull className="size-10 text-[#fffdf5]" strokeWidth={2.5} />
          )}
        </div>

        <h2
          className={`font-display mt-4 text-4xl leading-none sm:text-5xl ${
            iWon ? 'text-[#22c55e]' : 'text-[#ff3b30]'
          }`}
        >
          {iWon ? 'YOU WIN!' : 'YOU LOSE…'}
        </h2>

        <p className="mt-3 text-sm font-bold">{subtitle}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="font-display rounded-md border-[3px] border-black bg-[#0a0a0a] px-2.5 py-1 text-xs text-[#ffea00]">
            ROOM {view.roomCode}
          </span>
          <span className="font-display rounded-md border-[3px] border-black bg-white px-2.5 py-1 text-xs">
            {oppName}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {canRematch && (
            <button
              type="button"
              onClick={onRematch}
              className="font-display flex min-h-[52px] w-full items-center justify-center gap-3 rounded-lg border-[5px] border-black bg-[#ffea00] px-6 py-4 text-xl text-black shadow-[6px_6px_0_#0a0a0a] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#0a0a0a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              <RotateCcw className="size-6 shrink-0" strokeWidth={2.5} />
              REMATCH
            </button>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="font-display flex min-h-[52px] w-full items-center justify-center gap-3 rounded-lg border-[5px] border-black bg-white px-6 py-4 text-xl text-[#ff3b30] shadow-[6px_6px_0_#0a0a0a] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#0a0a0a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            <LogOut className="size-6 shrink-0" strokeWidth={2.5} />
            LEAVE MATCH
          </button>
        </div>
      </div>
    </div>
  )
}
