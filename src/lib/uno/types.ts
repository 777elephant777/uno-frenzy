// ─────────────────────────────────────────────────────────────
// UNO FRENZY — Shared type contracts
// Every agent MUST import shared types from this file.
// ─────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'chaotic' | 'insane'

export type Player = 'player' | 'ai'

export type CardKind =
  | 'number'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'draw4'
  | 'swap'
  | 'wildfire'
  | 'shield'
  | 'battle'

export interface UnoCard {
  /** unique card identity, stable across reshuffles */
  id: string
  kind: CardKind
  /** 0-9 for number cards, null otherwise */
  value: number | null
}

export type SoundName =
  | 'card'
  | 'draw'
  | 'skip'
  | 'reverse'
  | 'penalty'
  | 'shield'
  | 'swap'
  | 'wildfire'
  | 'battle'
  | 'mash'
  | 'tick'
  | 'chaos'
  | 'win'
  | 'lose'
  | 'uno'
  | 'click'
  | 'countdown'
  | 'go'

export type LogKind = 'info' | 'play' | 'penalty' | 'chaos' | 'battle' | 'shield' | 'win'

export interface LogEntry {
  id: number
  text: string
  kind: LogKind
  sound?: SoundName
}

export interface CareerStats {
  wins: number
  losses: number
  currentStreak: number
  bestStreak: number
  battlesWon: number
}

export type ChaosEventKind = 'draw-rain' | 'reshuffle' | 'morph'

export interface ChaosBannerInfo {
  id: number
  name: string
  description: string
}

export type BattlePhase = 'ready' | 'mash' | 'result'
export type BattleWinner = 'player' | 'ai' | 'tie' | null

export interface BattleState {
  phase: BattlePhase
  /** milliseconds remaining in the mash window (3000 → 0) */
  msLeft: number
  playerScore: number
  aiScore: number
  /** who played the BATTLE card */
  initiator: Player
  winner: BattleWinner
}

export type GamePhase = 'idle' | 'player-turn' | 'ai-turn' | 'battle' | 'game-over'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'EASY',
  chaotic: 'CHAOTIC',
  insane: 'INSANE',
}
