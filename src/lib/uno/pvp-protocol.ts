// ─────────────────────────────────────────────────────────────
// UNO FRENZY — PvP shared protocol (client ↔ server contract)
// Pure TypeScript, NO React/Next imports — this file is also
// imported by the socket.io mini-service at
// mini-services/uno-pvp/index.ts (via relative path).
// ─────────────────────────────────────────────────────────────
import type { BattlePhase, ChaosBannerInfo, LogEntry, SoundName, UnoCard } from './types'

/** Port the uno-pvp mini-service listens on (clients reach it through the Caddy gateway via `?XTransformPort=3005`) */
export const PVP_SERVICE_PORT = 3005

/** Canonical socket event names — never hard-code strings elsewhere */
export const PVP_EVENT = {
  /** server → client: full personalized room snapshot */
  ROOM_STATE: 'room:state',
  /** server → client: rare mid-game error message */
  ROOM_ERROR: 'room:error',
  /** client → server: create a room (host becomes seat 0) */
  ROOM_CREATE: 'room:create',
  /** client → server: join an existing room by code (becomes seat 1) */
  ROOM_JOIN: 'room:join',
  /** client → server: leave the room / forfeit */
  ROOM_LEAVE: 'room:leave',
  /** client → server: play a card from your hand */
  GAME_PLAY: 'game:play',
  /** client → server: draw a card from the deck */
  GAME_DRAW: 'game:draw',
  /** client → server: keep the drawn card (pass turn) */
  GAME_KEEP: 'game:keep',
  /** client → server: one mash tap in the Sudden Card Battle */
  BATTLE_MASH: 'battle:mash',
  /** client → server: start a fresh match in the same room */
  GAME_REMATCH: 'game:rematch',
} as const

export type PvpAckError =
  | 'not-found' // join: room code doesn't exist
  | 'full' // join: room already has 2 players
  | 'invalid-name' // create/join: empty/oversized name
  | 'invalid-code' // join: malformed room code
  | 'error' // unexpected

export interface PvpAck {
  ok: boolean
  error?: PvpAckError
  /** present on successful create */
  roomCode?: string
}

export type Seat = 0 | 1

export type PvpPhase =
  | 'waiting' // room open, waiting for the challenger
  | 'playing' // match in progress
  | 'battle' // sudden card battle mini-game
  | 'game-over' // someone won (or forfeit)

export interface PvpBattleView {
  phase: BattlePhase // 'ready' | 'mash' | 'result'
  /** milliseconds remaining in the mash window (3000 → 0) */
  msLeft: number
  /** raw taps per seat */
  scores: [number, number]
  winner: Seat | 'tie' | null
}

export interface PvpGameOverView {
  winner: Seat
  reason: 'empty-hand' | 'forfeit'
}

/**
 * Everything a single client needs to render the PvP screen.
 * The server personalizes `hand` + `pendingDrawn` per socket —
 * the opponent's cards are ONLY ever shared as a count.
 */
export interface PvpRoomView {
  roomCode: string
  you: Seat
  names: [string, string]
  phase: PvpPhase
  turn: Seat
  /** YOUR hand (face-up cards, server order) */
  hand: UnoCard[]
  opponentCardCount: number
  topCard: UnoCard | null
  deckCount: number
  /** chaos frenzy meter 0–100 */
  frenzy: number
  shields: [boolean, boolean]
  /** the card YOU just drew and may still play (null once decided) */
  pendingDrawn: UnoCard | null
  /** opponent drew a card and is deciding (or auto-passing) */
  opponentDeciding: boolean
  battle: PvpBattleView | null
  gameOver: PvpGameOverView | null
  opponentConnected: boolean
  /** increments per new match — clients re-key hands for deal animations */
  gameId: number
  log: LogEntry[]
  chaosBanner: ChaosBannerInfo | null
  /** increments on every chaos event — clients shake the screen */
  shakeSeq: number
}

/** Sound attached to log entries when a card is played (used by the SERVER) */
export const PVP_CARD_SOUNDS: Record<UnoCard['kind'], SoundName> = {
  number: 'card',
  skip: 'skip',
  reverse: 'reverse',
  draw2: 'penalty',
  draw4: 'penalty',
  swap: 'swap',
  wildfire: 'wildfire',
  shield: 'shield',
  battle: 'battle',
}
