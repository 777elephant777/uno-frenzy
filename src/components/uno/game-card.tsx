'use client'

import type { CSSProperties } from 'react'
import { ArrowLeftRight, Ban, Flame, RefreshCcw, Shield, Swords } from 'lucide-react'

import { cardName } from '@/lib/uno/engine'
import type { CardKind, UnoCard } from '@/lib/uno/types'
import { cn } from '@/lib/utils'

type CardSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<CardSize, string> = {
  sm: 'h-14 w-10 sm:h-16 sm:w-12',
  md: 'h-[5.95rem] w-[4.25rem] sm:h-28 sm:w-20',
  lg: 'h-28 w-20 sm:h-[8.4rem] sm:w-24',
}

const NUMBER_CLASS: Record<CardSize, string> = {
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-6xl',
}

const ICON_CLASS: Record<CardSize, string> = {
  sm: 'size-6',
  md: 'size-9',
  lg: 'size-10 sm:size-11',
}

const LABEL_CLASS: Record<CardSize, string> = {
  sm: 'text-[7px]',
  md: 'text-[9px]',
  lg: 'text-[10px]',
}

const ACTION_ICONS: Partial<Record<CardKind, typeof Ban>> = {
  skip: Ban,
  reverse: RefreshCcw,
  swap: ArrowLeftRight,
  wildfire: Flame,
  shield: Shield,
  battle: Swords,
}

const ACTION_LABELS: Record<string, string> = {
  skip: 'SKIP',
  reverse: 'REVERSE',
  draw2: 'PENALTY',
  draw4: 'MEGA',
  swap: 'SWAP',
  wildfire: 'WILDFIRE',
  shield: 'SHIELD',
  battle: 'BATTLE',
}

function ActionGlyph({ card, size }: { card: UnoCard; size: CardSize }) {
  if (card.kind === 'draw2' || card.kind === 'draw4') {
    return (
      <span className={cn('font-display leading-none', NUMBER_CLASS[size])}>
        {card.kind === 'draw2' ? '+2' : '+4'}
      </span>
    )
  }
  const Icon = ACTION_ICONS[card.kind]
  if (!Icon) return null
  return <Icon className={ICON_CLASS[size]} strokeWidth={2.5} />
}

export interface GameCardProps {
  card: UnoCard
  faceDown?: boolean
  size?: CardSize
  playable?: boolean
  interactive?: boolean
  highlight?: boolean
  dimmed?: boolean
  onClick?: () => void
  className?: string
  style?: CSSProperties
  title?: string
}

export function GameCard({
  card,
  faceDown = false,
  size = 'md',
  playable = false,
  interactive = false,
  highlight = false,
  dimmed = false,
  onClick,
  className,
  style,
  title,
}: GameCardProps) {
  const base = cn(
    'relative flex shrink-0 select-none flex-col items-center justify-center rounded-lg border-[3px] border-black bg-[#ffd600] shadow-[4px_4px_0_#0a0a0a]',
    SIZE_CLASS[size],
    interactive && 'transition-transform duration-150',
    interactive && playable &&
      'cursor-pointer hover:-translate-y-2 hover:rotate-[-2deg] hover:shadow-[6px_8px_0_#0a0a0a]',
    interactive && !playable && 'cursor-not-allowed opacity-45 saturate-50',
    !interactive && dimmed && 'opacity-45 saturate-50',
    highlight && 'ring-4 ring-black ring-offset-2 ring-offset-[#ffea00]',
    className,
  )

  const content = faceDown ? (
    <>
      <div
        aria-hidden
        className="absolute inset-1 rounded-md"
        style={{
          background:
            'repeating-linear-gradient(45deg, #0a0a0a 0 5px, #ffd600 5px 12px)',
        }}
      />
      <span className="font-display relative z-10 flex size-8 items-center justify-center rounded-full border-[3px] border-black bg-[#ffea00] text-sm sm:size-9 sm:text-base">
        U!
      </span>
    </>
  ) : card.kind === 'number' ? (
    <>
      {size !== 'sm' && (
        <span aria-hidden className="font-display absolute left-1.5 top-1 text-xs sm:text-sm">
          {card.value}
        </span>
      )}
      <span className={cn('font-display leading-none', NUMBER_CLASS[size])}>{card.value}</span>
      <span className={cn('font-display mt-1 tracking-widest text-black/60', LABEL_CLASS[size])}>
        YELLOW
      </span>
    </>
  ) : (
    <>
      <ActionGlyph card={card} size={size} />
      <span className={cn('font-display mt-1 tracking-widest', LABEL_CLASS[size])}>
        {ACTION_LABELS[card.kind] ?? ''}
      </span>
    </>
  )

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!playable}
        aria-label={`Play ${cardName(card)}`}
        title={title ?? (playable ? `Play ${cardName(card)}` : `${cardName(card)} — not playable now`)}
        className={base}
        style={style}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={base} style={style} title={title} aria-hidden={undefined}>
      {content}
    </div>
  )
}
