// ─────────────────────────────────────────────────────────────
// UNO FRENZY — Pure game engine (deck, rules, AI brain)
// NOTE: functions that need randomness are called from event
// handlers / effects (NOT inside the reducer) to keep the
// reducer pure. All helpers here are side-effect free.
// ─────────────────────────────────────────────────────────────
import { CardKind, ChaosEventKind, Difficulty, UnoCard } from './types'

export const FRENZY_PER_CARD = 8
export const STARTING_HAND = 7
export const BATTLE_MS = 3000
export const BATTLE_PENALTY = 4
export const BATTLE_TIE_PENALTY = 2
export const BATTLE_READY_MS = 900
export const BATTLE_RESULT_MS = 1700
export const BANNER_MS = 1800

/** AI mash rate (taps per second) in the Sudden Card Battle */
export const AI_BATTLE_RATES: Record<Difficulty, number> = {
  easy: 3.2,
  chaotic: 6.0,
  insane: 9.2,
}

let cardSeq = 0

function makeCard(kind: CardKind, value: number | null): UnoCard {
  cardSeq += 1
  return { id: `c${cardSeq}`, kind, value }
}

/** Fisher–Yates shuffle (returns a new array) */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 57 cards: numbers 0–9 ×3 + 27 action cards */
export function createDeck(): UnoCard[] {
  const deck: UnoCard[] = []
  for (let v = 0; v <= 9; v++) {
    for (let c = 0; c < 3; c++) deck.push(makeCard('number', v))
  }
  const actions: Array<[CardKind, number]> = [
    ['skip', 4],
    ['reverse', 4],
    ['draw2', 4],
    ['draw4', 3],
    ['swap', 3],
    ['wildfire', 3],
    ['shield', 3],
    ['battle', 3],
  ]
  for (const [kind, n] of actions) {
    for (let c = 0; c < n; c++) deck.push(makeCard(kind, null))
  }
  return shuffle(deck)
}

export function isAction(card: UnoCard): boolean {
  return card.kind !== 'number'
}

/**
 * The Frenzy matching rule: action cards are ALWAYS playable.
 * A number matches the top card's number; if the top card is an
 * action card, any number is legal.
 */
export function isPlayable(card: UnoCard, top: UnoCard | null): boolean {
  if (!top) return true
  if (isAction(card)) return true
  if (top.kind !== 'number') return true
  return card.value === top.value
}

export function cardName(card: UnoCard): string {
  if (card.kind === 'number') return `${card.value}`
  const names: Record<CardKind, string> = {
    number: '',
    skip: 'SKIP',
    reverse: 'REVERSE',
    draw2: '+2',
    draw4: 'MEGA +4',
    swap: 'SWAP',
    wildfire: 'WILDFIRE',
    shield: 'SHIELD',
    battle: 'BATTLE',
  }
  return names[card.kind]
}

export interface InitialGame {
  deck: UnoCard[]
  playerHand: UnoCard[]
  aiHand: UnoCard[]
  top: UnoCard
}

/** Deal a fresh game (called outside the reducer from a click handler) */
export function createInitialGame(): InitialGame {
  let deck = createDeck()
  const playerHand = deck.slice(0, STARTING_HAND)
  deck = deck.slice(STARTING_HAND)
  const aiHand = deck.slice(0, STARTING_HAND)
  deck = deck.slice(STARTING_HAND)
  // first discard must be a plain number card
  const idx = deck.findIndex((c) => c.kind === 'number')
  const top = deck.splice(idx, 1)[0]
  return { deck, playerHand, aiHand, top }
}

/** Fallback card when the chaos morph fires with an empty deck */
export function makeRandomNumberCard(): UnoCard {
  return makeCard('number', Math.floor(Math.random() * 10))
}

export interface AiContext {
  aiHand: UnoCard[]
  top: UnoCard
  difficulty: Difficulty
  playerHandCount: number
}

/** Pick the AI's next card. Returns null when it must draw. */
export function chooseAiCard({ aiHand, top, difficulty, playerHandCount }: AiContext): UnoCard | null {
  const playable = aiHand.filter((c) => isPlayable(c, top))
  if (playable.length === 0) return null
  const pick = (arr: UnoCard[]): UnoCard => arr[Math.floor(Math.random() * arr.length)]

  if (difficulty === 'easy') {
    // sloppy random play
    return pick(playable)
  }
  if (difficulty === 'chaotic') {
    // action-card aggression
    const actions = playable.filter(isAction)
    return pick(actions.length > 0 ? actions : playable)
  }

  // INSANE — tactical
  const find = (...kinds: CardKind[]): UnoCard | undefined =>
    playable.find((c) => kinds.includes(c.kind))

  if (playerHandCount <= 2) {
    // player is about to win: unload attacks
    return find('draw4', 'draw2', 'skip', 'reverse') ?? find('battle', 'swap', 'wildfire') ?? find('shield') ?? pick(playable)
  }
  const numbers = playable.filter((c) => c.kind === 'number')
  if (numbers.length > 0) {
    // dump numbers while it's safe, hoard action cards
    return pick(numbers)
  }
  if (aiHand.length >= 6) {
    // hand is bloated: shed the neutral actions
    return find('swap', 'wildfire', 'shield', 'battle') ?? pick(playable)
  }
  return pick(playable)
}

/** Chance the AI immediately plays the card it just drew */
export function aiShouldPlayDrawn(_card: UnoCard, difficulty: Difficulty): boolean {
  const chance = { easy: 0.5, chaotic: 0.75, insane: 1 }[difficulty]
  return Math.random() < chance
}

/** AI "reaction time" in ms before it acts */
export function aiTurnDelayMs(difficulty: Difficulty): number {
  const base = { easy: 1400, chaotic: 900, insane: 480 }[difficulty]
  const span = { easy: 600, chaotic: 600, insane: 420 }[difficulty]
  return base + Math.random() * span
}

export const CHAOS_EVENT_META: Record<ChaosEventKind, { name: string; description: string }> = {
  'draw-rain': { name: 'DRAW RAIN', description: 'Everyone draws 2 cards!' },
  reshuffle: { name: 'DECK EXPLOSION', description: 'The discard pile blasts back into the deck!' },
  morph: { name: 'TOP CARD MORPH', description: 'The top card transforms into something else!' },
}

export function pickChaosEvent(): ChaosEventKind {
  const roll = Math.random()
  if (roll < 0.4) return 'draw-rain'
  if (roll < 0.7) return 'reshuffle'
  return 'morph'
}
