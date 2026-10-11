'use client'

import type { ReactNode } from 'react'
import { Hand, Shield as ShieldIcon, User } from 'lucide-react'

import { ChaosMeter } from '@/components/uno/chaos-meter'
import { GameCard } from '@/components/uno/game-card'
import { cardName, isPlayable } from '@/lib/uno/engine'
import type { PvpRoomView } from '@/lib/uno/pvp-protocol'
import type { UnoCard } from '@/lib/uno/types'
import { cn } from '@/lib/utils'

const DECK_BACK: UnoCard = { id: 'deck-back', kind: 'number', value: 0 }

function Chip({
  children,
  variant = 'default',
  className,
}: {
  children: ReactNode
  variant?: 'default' | 'black' | 'red' | 'green' | 'orange' | 'shield' | 'uno'
  className?: string
}) {
  const variants: Record<string, string> = {
    default: 'bg-white text-black',
    black: 'bg-[#0a0a0a] text-[#ffea00]',
    red: 'bg-[#ff3b30] text-white',
    green: 'bg-[#22c55e] text-black',
    orange: 'bg-[#ff9500] text-black',
    shield: 'bg-white text-black',
    uno: 'bg-[#ff3b30] text-white',
  }
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-md border-[3px] border-black px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0_#0a0a0a]',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

function StatusLine({
  phase,
  oppName,
  myTurn,
}: {
  phase: PvpRoomView['phase']
  oppName: string
  myTurn: boolean
}) {
  if (phase === 'playing' && myTurn) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Chip variant="black" className="text-xs">
          ▶ YOUR TURN
        </Chip>
        <span className="text-xs font-bold text-black/70">
          Match the number or play an ACTION card
        </span>
      </div>
    )
  }
  if (phase === 'playing') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Chip variant="red" className="animate-pulse text-xs">
          {oppName} IS PLAYING…
        </Chip>
      </div>
    )
  }
  if (phase === 'battle') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Chip variant="orange" className="text-xs">
          ⚔ CARD BATTLE IN PROGRESS
        </Chip>
      </div>
    )
  }
  if (phase === 'game-over') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Chip variant="black" className="text-xs">
          GAME OVER
        </Chip>
      </div>
    )
  }
  return null
}

export function PvpGameBoard({
  view,
  onPlay,
  onDraw,
  onKeep,
  isCardPlayable,
}: {
  view: PvpRoomView
  onPlay: (cardId: string) => void
  onDraw: () => void
  onKeep: () => void
  isCardPlayable: (card: UnoCard) => boolean
}) {
  const you = view.you
  const opp = you === 0 ? 1 : 0
  const myName = view.names[you]
  const oppName = view.names[opp]
  const myTurn = view.phase === 'playing' && view.turn === you
  const canDraw = myTurn && !view.pendingDrawn
  const pending = view.pendingDrawn
  const pendingPlayable = pending ? isPlayable(pending, view.topCard) : false
  const oppCount = view.opponentCardCount

  return (
    <>
      {/* ── Opponent hand ───────────────────────────────── */}
      <section aria-label={`${oppName} hand`} className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <Chip variant="black" className="gap-1.5 text-xs">
            <User className="size-3.5" strokeWidth={2.5} /> {oppName}
          </Chip>
          <Chip className="text-xs">{oppCount} CARDS</Chip>
          {view.shields[opp] && (
            <Chip variant="shield" className="text-xs">
              <ShieldIcon className="size-3.5" strokeWidth={2.5} /> SHIELD
            </Chip>
          )}
          {oppCount === 1 && <Chip variant="uno" className="text-xs">UNO!</Chip>}
          {view.phase === 'playing' && view.turn !== you && (
            <Chip variant="red" className="animate-pulse text-xs">
              THEIR TURN
            </Chip>
          )}
          {view.opponentDeciding && (
            <Chip variant="orange" className="animate-pulse text-xs">
              DECIDING…
            </Chip>
          )}
        </div>
        <div className="flex max-w-full flex-wrap justify-center gap-1 sm:gap-1.5">
          {Array.from({ length: oppCount }, (_, i) => (
            <GameCard
              key={`${view.gameId}-opp-${i}`}
              card={DECK_BACK}
              faceDown
              size="sm"
              className="animate-deal"
              style={{ animationDelay: `${i * 35}ms` }}
            />
          ))}
        </div>
      </section>

      {/* ── Table ────────────────────────────────────────── */}
      <section
        aria-label="Game table"
        className="w-full rounded-xl border-[5px] border-black bg-[#fffdf5] p-4 shadow-[8px_8px_0_#0a0a0a] sm:p-5"
      >
        <StatusLine phase={view.phase} oppName={oppName} myTurn={myTurn} />
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
          {/* Draw pile */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onDraw}
              disabled={!canDraw}
              aria-label={`Draw a card from the pile, ${view.deckCount} remaining`}
              className="group relative h-28 w-20 transition-transform duration-150 enabled:cursor-pointer enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 sm:h-[8.4rem] sm:w-24"
            >
              {[2, 1, 0].map((i) => (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{ transform: `translate(${i * 3}px, ${i * 3}px)` }}
                >
                  <GameCard card={DECK_BACK} faceDown size="lg" />
                </div>
              ))}
              <span className="font-display absolute -right-2 -top-2 z-10 flex size-7 items-center justify-center rounded-full border-[3px] border-black bg-[#ff3b30] text-xs text-white shadow-[2px_2px_0_#0a0a0a]">
                {view.deckCount}
              </span>
            </button>
            <span className="font-display text-[10px] tracking-widest">
              DRAW PILE · TAP TO DRAW
            </span>
          </div>

          {/* Discard pile */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative h-28 w-20 sm:h-[8.4rem] sm:w-24">
              {view.topCard ? (
                <>
                  <div aria-hidden className="absolute inset-0 -rotate-6 opacity-60">
                    <GameCard card={view.topCard} size="lg" />
                  </div>
                  <div aria-hidden className="absolute inset-0 rotate-[4deg] opacity-80">
                    <GameCard card={view.topCard} size="lg" />
                  </div>
                  <div key={view.topCard.id} className="animate-pop absolute inset-0">
                    <GameCard card={view.topCard} size="lg" />
                  </div>
                </>
              ) : null}
            </div>
            <span className="font-display text-[10px] tracking-widest">
              DISCARD · TOP: {view.topCard ? cardName(view.topCard) : '—'}
            </span>
          </div>

          {/* Chaos frenzy meter */}
          <ChaosMeter value={view.frenzy} />
        </div>
      </section>

      {/* ── Your hand ────────────────────────────────────── */}
      <section aria-label="Your hand" className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <Chip variant="black" className="gap-1.5 text-xs">
            <Hand className="size-3.5" strokeWidth={2.5} /> YOU · {myName}
          </Chip>
          <Chip className="text-xs">{view.hand.length} CARDS</Chip>
          {view.shields[you] && (
            <Chip variant="shield" className="text-xs">
              <ShieldIcon className="size-3.5" strokeWidth={2.5} /> SHIELD
            </Chip>
          )}
          {view.hand.length === 1 && <Chip variant="uno" className="text-xs">UNO!</Chip>}
          {myTurn && <Chip variant="green" className="text-xs">▶ YOUR TURN</Chip>}
        </div>

        {pending && (
          <div className="animate-pop z-10 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border-[4px] border-black bg-[#ffea00] px-3 py-2 shadow-[4px_4px_0_#0a0a0a]">
            <span className="text-xs font-black uppercase tracking-wider">
              Drew: {cardName(pending)}
            </span>
            {pendingPlayable ? (
              <>
                <button
                  type="button"
                  onClick={() => onPlay(pending.id)}
                  className="font-display rounded-md border-[3px] border-black bg-[#0a0a0a] px-3 py-1 text-xs text-[#ffea00] shadow-[3px_3px_0_#0a0a0a] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  PLAY IT
                </button>
                <button
                  type="button"
                  onClick={onKeep}
                  className="font-display rounded-md border-[3px] border-black bg-white px-3 py-1 text-xs shadow-[3px_3px_0_#0a0a0a] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  KEEP
                </button>
              </>
            ) : (
              <span className="text-xs font-black uppercase tracking-wider text-black/60">
                No match — turn passes…
              </span>
            )}
          </div>
        )}

        <div className="flex max-w-full flex-wrap justify-center gap-1.5 sm:gap-2">
          {view.hand.map((card, i) => (
            <GameCard
              key={`${view.gameId}-${card.id}`}
              card={card}
              interactive
              playable={isCardPlayable(card)}
              highlight={pending?.id === card.id}
              onClick={() => onPlay(card.id)}
              size="md"
              className="animate-deal"
              style={{ animationDelay: `${i * 35}ms` }}
            />
          ))}
        </div>

        {myTurn && !pending && (
          <p className="text-xs font-bold text-black/60">
            Highlighted cards are playable — or tap the deck to draw.
          </p>
        )}
      </section>
    </>
  )
}
