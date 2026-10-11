'use client'

import type { ReactNode } from 'react'
import { Bot, Hand, Shield as ShieldIcon } from 'lucide-react'

import { ChaosMeter } from '@/components/uno/chaos-meter'
import { GameCard } from '@/components/uno/game-card'
import { cardName, isPlayable } from '@/lib/uno/engine'
import { DIFFICULTY_LABELS } from '@/lib/uno/types'
import type { UnoCard } from '@/lib/uno/types'
import type { UnoGameApi } from '@/hooks/use-uno-game'
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

function StatusLine({ phase }: { phase: UnoGameApi['state']['phase'] }) {
  if (phase === 'player-turn') {
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
  if (phase === 'ai-turn') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Chip variant="red" className="animate-pulse text-xs">
          CPU IS THINKING…
        </Chip>
        <span className="text-xs font-bold text-black/70">brace yourself</span>
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
          GAME OVER — press PLAY AGAIN
        </Chip>
      </div>
    )
  }
  return null
}

function IdlePanel({ onStart, difficulty }: { onStart: () => void; difficulty: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center sm:py-6">
      <span className="font-display rotate-[-2deg] rounded-lg border-[5px] border-black bg-[#0a0a0a] px-4 py-3 text-2xl text-[#ffea00] shadow-[6px_6px_0_#0a0a0a] sm:px-6 sm:text-4xl">
        UNO FRENZY
      </span>
      <p className="max-w-md text-sm font-bold leading-snug">
        Every card is <span className="bg-[#ffd600] px-1 font-black">YELLOW</span>. Match the numbers,
        unleash chaos, and be the first to empty your hand!
      </p>
      <button
        type="button"
        onClick={onStart}
        className="font-display rounded-lg border-[5px] border-black bg-[#ffea00] px-8 py-4 text-2xl shadow-[6px_6px_0_#0a0a0a] transition-transform duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_10px_0_#0a0a0a] active:translate-x-1 active:translate-y-1 active:shadow-none sm:text-3xl"
      >
        ▶ START GAME
      </button>
      <p className="text-xs font-bold text-black/60">
        Difficulty: {difficulty} — switch it above (it restarts the game instantly).
      </p>
    </div>
  )
}

export function GameBoard({ game }: { game: UnoGameApi }) {
  const { state, topCard, playCard, drawCard, keepDrawn, isCardPlayableNow, startGame } = game
  const revealAi = state.phase === 'game-over'
  const canDraw = state.phase === 'player-turn' && state.turn === 'player' && !state.pendingDraw
  const pendingCard = state.pendingDraw
    ? state.playerHand.find((c) => c.id === state.pendingDraw)
    : null
  const pendingPlayable = pendingCard ? isPlayable(pendingCard, topCard) : false

  return (
    <>
      {/* ── CPU hand ─────────────────────────────────────── */}
      <section aria-label="CPU hand" className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <Chip variant="black" className="gap-1.5 text-xs">
            <Bot className="size-3.5" strokeWidth={2.5} /> CPU
          </Chip>
          <Chip className="text-xs">{DIFFICULTY_LABELS[state.difficulty]}</Chip>
          <Chip className="text-xs">{state.aiHand.length} CARDS</Chip>
          {state.shields.ai && (
            <Chip variant="shield" className="text-xs">
              <ShieldIcon className="size-3.5" strokeWidth={2.5} /> SHIELD
            </Chip>
          )}
          {state.aiHand.length === 1 && <Chip variant="uno" className="text-xs">UNO!</Chip>}
          {state.phase === 'ai-turn' && (
            <Chip variant="red" className="animate-pulse text-xs">
              THINKING…
            </Chip>
          )}
        </div>
        <div className="flex max-w-full flex-wrap justify-center gap-1 sm:gap-1.5">
          {state.aiHand.map((card, i) => (
            <GameCard
              key={`${state.gameId}-${card.id}`}
              card={card}
              faceDown={!revealAi}
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
        {state.phase === 'idle' ? (
          <IdlePanel onStart={() => startGame(state.difficulty)} difficulty={DIFFICULTY_LABELS[state.difficulty]} />
        ) : (
          <>
            <StatusLine phase={state.phase} />
            <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
              {/* Draw pile */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={drawCard}
                  disabled={!canDraw}
                  aria-label={`Draw a card from the pile, ${state.deck.length} remaining`}
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
                    {state.deck.length}
                  </span>
                </button>
                <span className="font-display text-[10px] tracking-widest">
                  DRAW PILE · TAP TO DRAW
                </span>
              </div>

              {/* Discard pile */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="relative h-28 w-20 sm:h-[8.4rem] sm:w-24">
                  {topCard ? (
                    <>
                      <div
                        aria-hidden
                        className="absolute inset-0 -rotate-6 opacity-60"
                      >
                        <GameCard card={topCard} size="lg" />
                      </div>
                      <div aria-hidden className="absolute inset-0 rotate-[4deg] opacity-80">
                        <GameCard card={topCard} size="lg" />
                      </div>
                      <div key={topCard.id} className="animate-pop absolute inset-0">
                        <GameCard card={topCard} size="lg" />
                      </div>
                    </>
                  ) : null}
                </div>
                <span className="font-display text-[10px] tracking-widest">
                  DISCARD · TOP: {topCard ? cardName(topCard) : '—'}
                </span>
              </div>

              {/* Chaos frenzy meter */}
              <ChaosMeter value={state.frenzy} />
            </div>
          </>
        )}
      </section>

      {/* ── Player hand ──────────────────────────────────── */}
      <section aria-label="Your hand" className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <Chip variant="black" className="gap-1.5 text-xs">
            <Hand className="size-3.5" strokeWidth={2.5} /> YOU
          </Chip>
          <Chip className="text-xs">{state.playerHand.length} CARDS</Chip>
          {state.shields.player && (
            <Chip variant="shield" className="text-xs">
              <ShieldIcon className="size-3.5" strokeWidth={2.5} /> SHIELD
            </Chip>
          )}
          {state.playerHand.length === 1 && <Chip variant="uno" className="text-xs">UNO!</Chip>}
          {state.phase === 'player-turn' && <Chip variant="green" className="text-xs">▶ YOUR TURN</Chip>}
        </div>

        {pendingCard && (
          <div className="animate-pop z-10 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border-[4px] border-black bg-[#ffea00] px-3 py-2 shadow-[4px_4px_0_#0a0a0a]">
            <span className="text-xs font-black uppercase tracking-wider">
              Drew: {cardName(pendingCard)}
            </span>
            {pendingPlayable ? (
              <>
                <button
                  type="button"
                  onClick={() => playCard(pendingCard.id)}
                  className="font-display rounded-md border-[3px] border-black bg-[#0a0a0a] px-3 py-1 text-xs text-[#ffea00] shadow-[3px_3px_0_#0a0a0a] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  PLAY IT
                </button>
                <button
                  type="button"
                  onClick={keepDrawn}
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
          {state.playerHand.map((card, i) => {
            const playable = isCardPlayableNow(card)
            return (
              <GameCard
                key={`${state.gameId}-${card.id}`}
                card={card}
                interactive
                playable={playable}
                highlight={state.pendingDraw === card.id}
                onClick={() => playCard(card.id)}
                size="md"
                className="animate-deal"
                style={{ animationDelay: `${i * 35}ms` }}
              />
            )
          })}
        </div>

        {state.phase === 'player-turn' && !state.pendingDraw && state.playerHand.length > 0 && (
          <p className="text-xs font-bold text-black/60">
            Highlighted cards are playable — or tap the deck to draw.
          </p>
        )}
      </section>
    </>
  )
}
