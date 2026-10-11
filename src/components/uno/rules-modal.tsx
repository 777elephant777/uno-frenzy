'use client'

import { ArrowLeftRight, Ban, BookOpen, Flame, RefreshCcw, Shield, Swords, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

type ActionCardInfo = {
  name: string
  desc: string
  chipBg: string
  chipFg: string
  icon: LucideIcon | null
  chipText: string | null
  wide?: boolean
}

const ACTION_CARDS: ActionCardInfo[] = [
  {
    name: 'SKIP',
    desc: 'Opponent loses their turn.',
    chipBg: '#ffd600',
    chipFg: '#0a0a0a',
    icon: Ban,
    chipText: null,
  },
  {
    name: 'REVERSE',
    desc: 'The turn bounces back — you go again.',
    chipBg: '#ffd600',
    chipFg: '#0a0a0a',
    icon: RefreshCcw,
    chipText: null,
  },
  {
    name: '+2',
    desc: 'Opponent draws 2 and is skipped.',
    chipBg: '#ffd600',
    chipFg: '#0a0a0a',
    icon: null,
    chipText: '+2',
  },
  {
    name: 'MEGA +4',
    desc: 'Opponent draws 4 and is skipped. Devastating.',
    chipBg: '#ff3b30',
    chipFg: '#fffdf5',
    icon: null,
    chipText: '+4',
  },
  {
    name: 'SWAP',
    desc: "Instantly trade hands with the CPU. Brutal when you're losing.",
    chipBg: '#ff9500',
    chipFg: '#0a0a0a',
    icon: ArrowLeftRight,
    chipText: null,
  },
  {
    name: 'WILDFIRE',
    desc: 'EVERYONE draws 1 card.',
    chipBg: '#ff9500',
    chipFg: '#0a0a0a',
    icon: Flame,
    chipText: null,
  },
  {
    name: 'SHIELD',
    desc: 'Raises a barrier that blocks the next time you are forced to draw (+2, +4, battle penalties, wildfire, chaos draws) — then it breaks.',
    chipBg: '#22c55e',
    chipFg: '#0a0a0a',
    icon: Shield,
    chipText: null,
    wide: true,
  },
  {
    name: 'BATTLE',
    desc: 'Triggers the SUDDEN CARD BATTLE mini-game.',
    chipBg: '#ff3b30',
    chipFg: '#fffdf5',
    icon: Swords,
    chipText: null,
  },
]

const CHAOS_EVENTS: Array<{ name: string; desc: string }> = [
  { name: 'DRAW RAIN', desc: 'everyone draws 2' },
  { name: 'DECK EXPLOSION', desc: 'reshuffle' },
  { name: 'TOP CARD MORPH', desc: 'the pile shapeshifts' },
]

const DIFFICULTIES: Array<{ name: string; desc: string; bg: string }> = [
  { name: 'EASY', desc: 'Sleepy & sloppy.', bg: '#22c55e' },
  { name: 'CHAOTIC', desc: 'Unpredictable action-card spam.', bg: '#ff9500' },
  { name: 'INSANE', desc: 'Fast, tactical, merciless.', bg: '#ff3b30' },
]

function RuleSection({
  index,
  title,
  highlight = false,
  children,
}: {
  index: number
  title: string
  highlight?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={`rounded-lg border-[3px] border-black p-3 sm:p-4 ${highlight ? 'bg-[#ffd600]' : 'bg-white'}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-display flex size-7 shrink-0 items-center justify-center rounded-md border-[3px] border-black bg-[#0a0a0a] text-xs text-[#ffea00]">
          {index}
        </span>
        <h3 className="font-display text-sm tracking-wide sm:text-base">{title}</h3>
      </div>
      <div className="mt-2 space-y-2 text-sm font-bold leading-snug">{children}</div>
    </section>
  )
}

export function RulesModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[92vw] gap-0 rounded-xl border-[5px] border-black bg-[#fffdf5] p-0 shadow-[8px_8px_0_#0a0a0a] sm:max-w-lg"
      >
        <div className="flex items-center gap-3 border-b-[5px] border-black bg-[#ffea00] p-4 pr-16 sm:p-5 sm:pr-20">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border-[3px] border-black bg-[#0a0a0a] text-[#ffea00] sm:size-11">
            <BookOpen className="size-5 sm:size-6" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl leading-none sm:text-2xl">
              HOW TO PLAY
            </DialogTitle>
            <DialogDescription className="mt-1 text-[11px] font-bold sm:text-xs">
              The complete UNO FRENZY rulebook. Read it or perish.
            </DialogDescription>
          </div>
        </div>

        <DialogClose
          aria-label="Close rules"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-md border-[3px] border-black bg-[#ffea00] text-black shadow-[3px_3px_0_#0a0a0a] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#0a0a0a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <X className="size-5" strokeWidth={2.5} />
        </DialogClose>

        <div className="brutal-scroll max-h-[70vh] overflow-y-auto p-4 sm:p-5">
          <div className="space-y-3">
            <RuleSection index={1} title="THE TWIST" highlight>
              <p>
                Every card is <strong>YELLOW</strong>. Forget colors — match the{' '}
                <strong>NUMBER</strong> on the discard pile, or slam an{' '}
                <strong>ACTION</strong> card at any time.
              </p>
            </RuleSection>

            <RuleSection index={2} title="NUMBER CARDS 0–9">
              <p>
                Play a number only if it matches the top card&apos;s number. If the top card
                is an action card, any number is legal.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Array.from({ length: 10 }, (_, n) => (
                  <span
                    key={n}
                    className="font-display flex size-8 items-center justify-center rounded-md border-[3px] border-black bg-[#ffd600] text-sm"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </RuleSection>

            <RuleSection index={3} title="ACTION CARDS — ALWAYS PLAYABLE">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ACTION_CARDS.map((card) => {
                  const Icon = card.icon
                  return (
                    <div
                      key={card.name}
                      className={`flex items-center gap-2.5 rounded-md border-[3px] border-black bg-[#fffdf5] p-2 ${
                        card.wide ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <span
                        className="font-display flex size-10 shrink-0 items-center justify-center rounded-md border-[3px] border-black text-sm"
                        style={{ backgroundColor: card.chipBg, color: card.chipFg }}
                      >
                        {Icon ? <Icon className="size-5" strokeWidth={2.5} /> : card.chipText}
                      </span>
                      <p className="text-xs leading-snug sm:text-sm">
                        <span className="font-display">{card.name}</span> — {card.desc}
                      </p>
                    </div>
                  )
                })}
              </div>
            </RuleSection>

            <RuleSection index={4} title="SUDDEN CARD BATTLE">
              <p>
                3 seconds of button-mashing fury. Highest score wins; the loser draws 4
                cards. Ties hurt everyone.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-display rounded-md border-[3px] border-black bg-[#ff3b30] px-2 py-0.5 text-xs">
                  3 SECONDS
                </span>
                <span className="font-display rounded-md border-[3px] border-black bg-[#ffea00] px-2 py-0.5 text-xs">
                  MASH TO WIN
                </span>
              </div>
            </RuleSection>

            <RuleSection index={5} title="CHAOS FRENZY METER">
              <p>Every card played charges the meter. At 100% a random CHAOS EVENT erupts:</p>
              <div className="h-4 w-full border-[3px] border-black bg-white">
                <div className="h-full w-[75%] bg-[#ff9500]" />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CHAOS_EVENTS.map((event) => (
                  <span
                    key={event.name}
                    className="font-display rounded-md border-[3px] border-black bg-[#ff9500] px-2 py-0.5 text-[10px] sm:text-xs"
                  >
                    {event.name} — {event.desc}
                  </span>
                ))}
              </div>
            </RuleSection>

            <RuleSection index={6} title="WINNING">
              <p>
                First to empty their hand wins. Shout{' '}
                <span className="font-display inline-block rounded-sm border-[3px] border-black bg-[#ffea00] px-1.5">
                  UNO
                </span>{' '}
                when you hold one card.
              </p>
            </RuleSection>

            <RuleSection index={7} title="DIFFICULTY">
              <div className="space-y-1.5">
                {DIFFICULTIES.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span
                      className="font-display flex h-8 w-[104px] shrink-0 items-center justify-center rounded-md border-[3px] border-black px-2 text-xs"
                      style={{ backgroundColor: d.bg }}
                    >
                      {d.name}
                    </span>
                    <p className="text-xs sm:text-sm">{d.desc}</p>
                  </div>
                ))}
              </div>
            </RuleSection>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
