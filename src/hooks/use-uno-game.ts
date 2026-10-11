'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import {
  AI_BATTLE_RATES,
  BANNER_MS,
  BATTLE_MS,
  BATTLE_PENALTY,
  BATTLE_READY_MS,
  BATTLE_RESULT_MS,
  BATTLE_TIE_PENALTY,
  CHAOS_EVENT_META,
  FRENZY_PER_CARD,
  aiShouldPlayDrawn,
  aiTurnDelayMs,
  cardName,
  chooseAiCard,
  createInitialGame,
  isPlayable,
  makeRandomNumberCard,
  pickChaosEvent,
  shuffle,
  type InitialGame,
} from '@/lib/uno/engine'
import { sound } from '@/lib/uno/sound'
import { DEFAULT_STATS, loadSoundPref, loadStats, saveSoundPref, saveStats } from '@/lib/uno/stats'
import type {
  BattleState,
  CareerStats,
  ChaosBannerInfo,
  ChaosEventKind,
  Difficulty,
  GamePhase,
  LogEntry,
  LogKind,
  Player,
  SoundName,
  UnoCard,
} from '@/lib/uno/types'

// ─────────────────────────────────────────────────────────────
// State & actions
// ─────────────────────────────────────────────────────────────

export interface GameState {
  phase: GamePhase
  difficulty: Difficulty
  /** increments per new game — used to re-key hands for deal animations */
  gameId: number
  deck: UnoCard[]
  discard: UnoCard[]
  playerHand: UnoCard[]
  aiHand: UnoCard[]
  turn: Player
  /** increments on every turn-affecting action */
  turnSeq: number
  frenzy: number
  chaosPending: boolean
  chaosBanner: ChaosBannerInfo | null
  bannerSeq: number
  shakeSeq: number
  shields: { player: boolean; ai: boolean }
  log: LogEntry[]
  logSeq: number
  battle: BattleState | null
  winner: Player | null
  /** card the player just drew and may still play */
  pendingDraw: string | null
  /** card the AI just drew and must decide on */
  aiPendingDrawn: string | null
  stats: CareerStats
  soundOn: boolean
}

export type GameAction =
  | { type: 'BOOT'; stats: CareerStats; soundOn: boolean }
  | { type: 'NEW_GAME'; difficulty: Difficulty; setup: InitialGame }
  | { type: 'PLAYER_DRAW' }
  | { type: 'PLAYER_PLAY'; cardId: string }
  | { type: 'KEEP_DRAWN'; auto?: boolean }
  | { type: 'AI_PLAY'; cardId: string }
  | { type: 'AI_DRAW' }
  | { type: 'AI_PASS' }
  | { type: 'APPLY_CHAOS'; event: ChaosEventKind; morphCard: UnoCard | null; shuffledDeck: UnoCard[] | null }
  | { type: 'CLEAR_BANNER' }
  | { type: 'BATTLE_GO' }
  | { type: 'BATTLE_TICK'; aiGain: number }
  | { type: 'BATTLE_MASH' }
  | { type: 'BATTLE_CLOSE' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'RESET_STATS' }

const CARD_SOUNDS: Record<UnoCard['kind'], SoundName> = {
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

const initialState: GameState = {
  phase: 'idle',
  difficulty: 'chaotic',
  gameId: 0,
  deck: [],
  discard: [],
  playerHand: [],
  aiHand: [],
  turn: 'player',
  turnSeq: 0,
  frenzy: 0,
  chaosPending: false,
  chaosBanner: null,
  bannerSeq: 0,
  shakeSeq: 0,
  shields: { player: false, ai: false },
  log: [],
  logSeq: 0,
  battle: null,
  winner: null,
  pendingDraw: null,
  aiPendingDrawn: null,
  stats: { ...DEFAULT_STATS },
  soundOn: true,
}

// ─────────────────────────────────────────────────────────────
// Reducer helpers (operate on a shallow "draft" copy)
// ─────────────────────────────────────────────────────────────

function draft(state: GameState): GameState {
  return {
    ...state,
    deck: [...state.deck],
    discard: [...state.discard],
    playerHand: [...state.playerHand],
    aiHand: [...state.aiHand],
    shields: { ...state.shields },
    log: [...state.log],
    battle: state.battle ? { ...state.battle } : null,
  }
}

function pushLog(d: GameState, text: string, kind: LogKind, soundName?: SoundName): void {
  d.logSeq += 1
  d.log.push({ id: d.logSeq, text, kind, sound: soundName })
  if (d.log.length > 80) d.log = d.log.slice(-80)
}

function passTurn(d: GameState, to: Player): void {
  d.turn = to
  d.phase = to === 'player' ? 'player-turn' : 'ai-turn'
  d.turnSeq += 1
}

function drawCard(d: GameState): UnoCard | null {
  if (d.deck.length === 0) {
    if (d.discard.length <= 1) return null
    const top = d.discard[d.discard.length - 1]
    d.deck = shuffle(d.discard.slice(0, -1))
    d.discard = [top]
    pushLog(d, 'Deck empty — discard pile blasts back into the deck!', 'info', 'swap')
  }
  return d.deck.shift() ?? null
}

function applyPenalty(d: GameState, target: Player, count: number): void {
  const isPlayer = target === 'player'
  const name = isPlayer ? 'You' : 'CPU'
  if (d.shields[target]) {
    d.shields[target] = false
    pushLog(d, `${isPlayer ? 'Your' : "CPU's"} SHIELD absorbs the attack — no cards drawn!`, 'shield', 'shield')
    return
  }
  let drawn = 0
  for (let i = 0; i < count; i++) {
    const card = drawCard(d)
    if (!card) break
    ;(isPlayer ? d.playerHand : d.aiHand).push(card)
    drawn += 1
  }
  if (drawn > 0) {
    pushLog(d, `${name} draw${isPlayer ? '' : 's'} ${drawn} card${drawn === 1 ? '' : 's'}!`, 'penalty', 'penalty')
  } else {
    pushLog(d, `${name} would draw, but every card is in play!`, 'info')
  }
}

function playCard(d: GameState, who: Player, card: UnoCard): void {
  const isPlayer = who === 'player'
  const name = isPlayer ? 'You' : 'CPU'
  const opponent: Player = isPlayer ? 'ai' : 'player'

  // remove from hand → top of discard
  if (isPlayer) d.playerHand = d.playerHand.filter((c) => c.id !== card.id)
  else d.aiHand = d.aiHand.filter((c) => c.id !== card.id)
  d.discard.push(card)
  if (d.pendingDraw === card.id) d.pendingDraw = null
  if (d.aiPendingDrawn === card.id) d.aiPendingDrawn = null

  const remaining = (isPlayer ? d.playerHand : d.aiHand).length

  pushLog(d, `${name} play${isPlayer ? '' : 's'} ${cardName(card)}!`, 'play', CARD_SOUNDS[card.kind])

  // chaos frenzy meter
  d.frenzy = d.frenzy + FRENZY_PER_CARD
  if (d.frenzy >= 100) {
    d.frenzy -= 100
    d.chaosPending = true
  }

  // UNO shout
  if (remaining === 1) {
    pushLog(d, isPlayer ? 'You shout UNO!' : 'CPU shouts UNO!', 'info', 'uno')
  }

  // WIN — first to empty their hand (pending effects are void)
  if (remaining === 0) {
    d.winner = who
    d.phase = 'game-over'
    d.battle = null
    d.pendingDraw = null
    d.aiPendingDrawn = null
    if (isPlayer) {
      const streak = d.stats.currentStreak + 1
      d.stats = {
        ...d.stats,
        wins: d.stats.wins + 1,
        currentStreak: streak,
        bestStreak: Math.max(d.stats.bestStreak, streak),
      }
      pushLog(d, 'YOU WIN! Empty hand — FRENZY MASTER!', 'win', 'win')
    } else {
      d.stats = { ...d.stats, losses: d.stats.losses + 1, currentStreak: 0 }
      pushLog(d, 'CPU WINS! Its hand hit zero first.', 'win', 'lose')
    }
    return
  }

  // card effects
  switch (card.kind) {
    case 'number':
      passTurn(d, opponent)
      break
    case 'skip':
      pushLog(d, isPlayer ? 'CPU is SKIPPED — go again!' : 'You are SKIPPED — CPU goes again!', 'info')
      passTurn(d, who)
      break
    case 'reverse':
      pushLog(d, 'REVERSE — the turn bounces right back!', 'info')
      passTurn(d, who)
      break
    case 'draw2':
      applyPenalty(d, opponent, 2)
      pushLog(d, isPlayer ? 'CPU is skipped — go again!' : 'You are skipped — CPU goes again!', 'info')
      passTurn(d, who)
      break
    case 'draw4':
      applyPenalty(d, opponent, 4)
      pushLog(d, isPlayer ? 'CPU is skipped — go again!' : 'You are skipped — CPU goes again!', 'info')
      passTurn(d, who)
      break
    case 'swap': {
      const t = d.playerHand
      d.playerHand = d.aiHand
      d.aiHand = t
      pushLog(d, 'HANDS SWAPPED — chaos reigns!', 'chaos', 'swap')
      passTurn(d, opponent)
      break
    }
    case 'wildfire':
      pushLog(d, 'WILDFIRE — everyone draws 1!', 'chaos', 'wildfire')
      applyPenalty(d, 'player', 1)
      applyPenalty(d, 'ai', 1)
      passTurn(d, opponent)
      break
    case 'shield':
      d.shields[who] = true
      pushLog(d, isPlayer ? 'You raise a SHIELD!' : 'CPU raises a SHIELD!', 'shield', 'shield')
      passTurn(d, opponent)
      break
    case 'battle':
      pushLog(d, 'SUDDEN CARD BATTLE! MASH TO WIN!', 'battle', 'battle')
      d.battle = {
        phase: 'ready',
        msLeft: BATTLE_MS,
        playerScore: 0,
        aiScore: 0,
        initiator: who,
        winner: null,
      }
      d.phase = 'battle'
      break
  }
}

function resolveBattle(d: GameState): void {
  const b = d.battle
  if (!b) return
  b.phase = 'result'
  b.winner = b.playerScore > b.aiScore ? 'player' : b.aiScore > b.playerScore ? 'ai' : 'tie'
  if (b.winner === 'player') {
    d.stats = { ...d.stats, battlesWon: d.stats.battlesWon + 1 }
    pushLog(d, `YOU WIN THE BATTLE ${b.playerScore}—${b.aiScore}!`, 'battle', 'battle')
    applyPenalty(d, 'ai', BATTLE_PENALTY)
  } else if (b.winner === 'ai') {
    pushLog(d, `CPU WINS THE BATTLE ${b.aiScore}—${b.playerScore}!`, 'battle', 'penalty')
    applyPenalty(d, 'player', BATTLE_PENALTY)
  } else {
    pushLog(d, `BATTLE TIE ${b.playerScore}—${b.aiScore}!`, 'battle', 'penalty')
    applyPenalty(d, 'player', BATTLE_TIE_PENALTY)
    applyPenalty(d, 'ai', BATTLE_TIE_PENALTY)
  }
}

// ─────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'BOOT':
      return { ...state, stats: action.stats, soundOn: action.soundOn }

    case 'NEW_GAME': {
      return {
        ...state,
        phase: 'player-turn',
        difficulty: action.difficulty,
        gameId: state.gameId + 1,
        deck: action.setup.deck,
        discard: [action.setup.top],
        playerHand: action.setup.playerHand,
        aiHand: action.setup.aiHand,
        turn: 'player',
        turnSeq: state.turnSeq + 1,
        frenzy: 0,
        chaosPending: false,
        chaosBanner: null,
        shields: { player: false, ai: false },
        battle: null,
        winner: null,
        pendingDraw: null,
        aiPendingDrawn: null,
        log: [
          {
            id: state.logSeq + 1,
            text: `NEW GAME vs ${action.difficulty.toUpperCase()} CPU — you go first!`,
            kind: 'info',
          },
        ],
        logSeq: state.logSeq + 1,
      }
    }

    case 'PLAYER_DRAW': {
      if (state.phase !== 'player-turn' || state.turn !== 'player' || state.pendingDraw) return state
      const d = draft(state)
      const card = drawCard(d)
      if (!card) {
        pushLog(d, 'No cards left to draw — turn passes.', 'info')
        passTurn(d, 'ai')
        return d
      }
      d.playerHand.push(card)
      d.pendingDraw = card.id
      pushLog(d, `You draw a card.`, 'info', 'draw')
      return d
    }

    case 'PLAYER_PLAY': {
      if (state.phase !== 'player-turn' || state.turn !== 'player') return state
      const card = state.playerHand.find((c) => c.id === action.cardId)
      if (!card) return state
      if (state.pendingDraw && state.pendingDraw !== card.id) return state
      if (!state.pendingDraw && !isPlayable(card, state.discard[state.discard.length - 1] ?? null)) {
        return state
      }
      const d = draft(state)
      playCard(d, 'player', card)
      return d
    }

    case 'KEEP_DRAWN': {
      if (state.phase !== 'player-turn' || !state.pendingDraw) return state
      const d = draft(state)
      d.pendingDraw = null
      pushLog(d, action.auto ? 'No match — turn passes.' : 'You keep the drawn card.', 'info')
      passTurn(d, 'ai')
      return d
    }

    case 'AI_PLAY': {
      if (state.phase !== 'ai-turn' || state.turn !== 'ai') return state
      const card = state.aiHand.find((c) => c.id === action.cardId)
      if (!card || !isPlayable(card, state.discard[state.discard.length - 1] ?? null)) return state
      const d = draft(state)
      playCard(d, 'ai', card)
      return d
    }

    case 'AI_DRAW': {
      if (state.phase !== 'ai-turn' || state.turn !== 'ai' || state.aiPendingDrawn) return state
      const d = draft(state)
      const card = drawCard(d)
      if (!card) {
        pushLog(d, 'CPU has no cards to draw — turn passes.', 'info')
        passTurn(d, 'player')
        return d
      }
      d.aiHand.push(card)
      d.aiPendingDrawn = card.id
      pushLog(d, 'CPU draws a card.', 'info', 'draw')
      return d
    }

    case 'AI_PASS': {
      if (state.phase !== 'ai-turn' || !state.aiPendingDrawn) return state
      const d = draft(state)
      d.aiPendingDrawn = null
      pushLog(d, 'CPU keeps its drawn card.', 'info')
      passTurn(d, 'player')
      return d
    }

    case 'APPLY_CHAOS': {
      if (!state.chaosPending) return state
      const d = draft(state)
      d.chaosPending = false
      const meta = CHAOS_EVENT_META[action.event]
      d.bannerSeq += 1
      d.chaosBanner = { id: d.bannerSeq, name: meta.name, description: meta.description }
      d.shakeSeq += 1
      pushLog(d, `CHAOS EVENT: ${meta.name} — ${meta.description}`, 'chaos', 'chaos')

      if (action.event === 'draw-rain') {
        applyPenalty(d, 'player', 2)
        applyPenalty(d, 'ai', 2)
      } else if (action.event === 'reshuffle') {
        if (action.shuffledDeck && action.shuffledDeck.length > 0) {
          d.deck = action.shuffledDeck
          d.discard = d.discard.length > 0 ? [d.discard[d.discard.length - 1]] : []
          pushLog(d, `Deck rebuilt — ${d.deck.length} cards ready.`, 'info')
        }
      } else if (action.event === 'morph' && action.morphCard) {
        const morph = action.morphCard
        d.deck = d.deck.filter((c) => c.id !== morph.id)
        const oldTop = d.discard.pop()
        if (oldTop) d.deck.push(oldTop)
        d.discard.push(morph)
        pushLog(d, `The top card morphs into ${cardName(morph)}!`, 'chaos')
      }
      return d
    }

    case 'CLEAR_BANNER':
      return state.chaosBanner ? { ...state, chaosBanner: null } : state

    case 'BATTLE_GO': {
      if (state.phase !== 'battle' || !state.battle || state.battle.phase !== 'ready') return state
      const d = draft(state)
      if (d.battle) d.battle.phase = 'mash'
      return d
    }

    case 'BATTLE_TICK': {
      if (state.phase !== 'battle' || !state.battle || state.battle.phase !== 'mash') return state
      const d = draft(state)
      const b = d.battle
      if (!b) return d
      b.aiScore = Math.round(b.aiScore + action.aiGain)
      b.msLeft = Math.max(0, b.msLeft - 100)
      if (b.msLeft <= 0) resolveBattle(d)
      return d
    }

    case 'BATTLE_MASH': {
      if (state.phase !== 'battle' || !state.battle || state.battle.phase !== 'mash') return state
      const d = draft(state)
      if (d.battle) d.battle.playerScore += 1
      return d
    }

    case 'BATTLE_CLOSE': {
      if (state.phase !== 'battle' || !state.battle) return state
      const d = draft(state)
      const initiator = d.battle?.initiator ?? 'player'
      d.battle = null
      passTurn(d, initiator === 'player' ? 'ai' : 'player')
      return d
    }

    case 'TOGGLE_SOUND':
      return { ...state, soundOn: !state.soundOn }

    case 'RESET_STATS':
      return { ...state, stats: { ...DEFAULT_STATS } }

    default:
      return state
  }
}

// ─────────────────────────────────────────────────────────────
// The hook
// ─────────────────────────────────────────────────────────────

export interface UnoGameApi {
  state: GameState
  topCard: UnoCard | null
  startGame: (difficulty: Difficulty) => void
  restart: () => void
  setDifficulty: (difficulty: Difficulty) => void
  playCard: (cardId: string) => void
  drawCard: () => void
  keepDrawn: () => void
  mash: () => void
  toggleSound: () => void
  resetStats: () => void
  isCardPlayableNow: (card: UnoCard) => boolean
}

export function useUnoGame(): UnoGameApi {
  const [state, dispatch] = useReducer(reducer, initialState)
  const lastSoundIdRef = useRef(0)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // BOOT — load persisted stats + sound preference
  useEffect(() => {
    dispatch({ type: 'BOOT', stats: loadStats(), soundOn: loadSoundPref() })
  }, [])

  // keep the sound engine in sync + persist preference
  useEffect(() => {
    sound.setMuted(!state.soundOn)
    saveSoundPref(state.soundOn)
  }, [state.soundOn])

  // persist career stats
  useEffect(() => {
    saveStats(state.stats)
  }, [state.stats])

  // play sounds attached to new log entries
  useEffect(() => {
    const fresh = state.log.filter((e) => e.id > lastSoundIdRef.current)
    if (fresh.length === 0) return
    let max = lastSoundIdRef.current
    for (const entry of fresh) {
      if (entry.id > max) max = entry.id
      if (entry.sound) sound.play(entry.sound)
    }
    lastSoundIdRef.current = max
  }, [state.log])

  // resolve pending chaos events — all randomness lives here, outside the reducer
  useEffect(() => {
    if (!state.chaosPending) return
    if (state.phase === 'game-over' || state.phase === 'battle') return
    const event = pickChaosEvent()
    let morphCard: UnoCard | null = null
    let shuffledDeck: UnoCard[] | null = null
    if (event === 'morph') {
      morphCard =
        state.deck.length > 0
          ? state.deck[Math.floor(Math.random() * state.deck.length)]
          : makeRandomNumberCard()
    }
    if (event === 'reshuffle') {
      shuffledDeck = shuffle([...state.deck, ...state.discard.slice(0, -1)])
    }
    dispatch({ type: 'APPLY_CHAOS', event, morphCard, shuffledDeck })
  }, [state.chaosPending, state.phase, state.deck, state.discard])

  // auto-dismiss the chaos banner
  useEffect(() => {
    if (!state.chaosBanner) return
    const t = setTimeout(() => dispatch({ type: 'CLEAR_BANNER' }), BANNER_MS)
    return () => clearTimeout(t)
  }, [state.chaosBanner])

  // chaos screen-shake — applied straight to the DOM (no re-render).
  // The page shell carries id="uno-frenzy-shell".
  useEffect(() => {
    if (state.shakeSeq === 0) return
    const el = document.getElementById('uno-frenzy-shell')
    if (!el) return
    el.classList.remove('animate-screen-shake')
    // force reflow so the animation can restart on rapid successive events
    void el.offsetWidth
    el.classList.add('animate-screen-shake')
    const t = setTimeout(() => el.classList.remove('animate-screen-shake'), 560)
    return () => {
      clearTimeout(t)
      el.classList.remove('animate-screen-shake')
    }
  }, [state.shakeSeq])

  // AI turn scheduler
  useEffect(() => {
    if (state.phase !== 'ai-turn' || state.turn !== 'ai') return
    if (state.chaosPending || state.chaosBanner || state.battle || state.aiPendingDrawn) return
    const delay = aiTurnDelayMs(state.difficulty)
    const timer = setTimeout(() => {
      const s = stateRef.current
      if (s.phase !== 'ai-turn' || s.turn !== 'ai') return
      const top = s.discard[s.discard.length - 1]
      const card = chooseAiCard({
        aiHand: s.aiHand,
        top,
        difficulty: s.difficulty,
        playerHandCount: s.playerHand.length,
      })
      if (card) dispatch({ type: 'AI_PLAY', cardId: card.id })
      else dispatch({ type: 'AI_DRAW' })
    }, delay)
    return () => clearTimeout(timer)
  }, [state])

  // AI follow-up: decide whether to play the card it just drew
  useEffect(() => {
    if (state.phase !== 'ai-turn' || !state.aiPendingDrawn) return
    if (state.chaosPending || state.chaosBanner) return
    const timer = setTimeout(
      () => {
        const s = stateRef.current
        const cardId = s.aiPendingDrawn
        if (!cardId || s.phase !== 'ai-turn') return
        const card = s.aiHand.find((c) => c.id === cardId)
        const top = s.discard[s.discard.length - 1]
        if (card && isPlayable(card, top) && aiShouldPlayDrawn(card, s.difficulty)) {
          dispatch({ type: 'AI_PLAY', cardId })
        } else {
          dispatch({ type: 'AI_PASS' })
        }
      },
      700 + Math.random() * 450,
    )
    return () => clearTimeout(timer)
  }, [state])

  // auto-pass when the player's drawn card can't be played
  useEffect(() => {
    if (state.phase !== 'player-turn' || !state.pendingDraw) return
    const card = state.playerHand.find((c) => c.id === state.pendingDraw)
    const top = state.discard[state.discard.length - 1] ?? null
    if (card && isPlayable(card, top)) return
    const timer = setTimeout(() => dispatch({ type: 'KEEP_DRAWN', auto: true }), 1200)
    return () => clearTimeout(timer)
  }, [state])

  // battle lifecycle manager
  useEffect(() => {
    const b = state.battle
    if (state.phase !== 'battle' || !b) return
    if (b.phase === 'ready') {
      const t = setTimeout(() => {
        sound.play('go')
        dispatch({ type: 'BATTLE_GO' })
      }, BATTLE_READY_MS)
      return () => clearTimeout(t)
    }
    if (b.phase === 'mash') {
      const rate = AI_BATTLE_RATES[state.difficulty]
      const interval = setInterval(() => {
        const gain = rate * 0.1 * (0.7 + Math.random() * 0.6)
        dispatch({ type: 'BATTLE_TICK', aiGain: gain })
      }, 100)
      return () => clearInterval(interval)
    }
    const t = setTimeout(() => dispatch({ type: 'BATTLE_CLOSE' }), BATTLE_RESULT_MS)
    return () => clearTimeout(t)
  }, [state.phase, state.battle?.phase])

  // countdown beeps at each whole second
  useEffect(() => {
    const b = state.battle
    if (state.phase === 'battle' && b && b.phase === 'mash' && b.msLeft > 0 && b.msLeft % 1000 === 0) {
      sound.play('countdown')
    }
  }, [state.battle?.msLeft, state.phase, state.battle?.phase])

  // mash (giant button + SPACE bar)
  const mash = useCallback(() => {
    const s = stateRef.current
    if (s.phase === 'battle' && s.battle && s.battle.phase === 'mash') {
      dispatch({ type: 'BATTLE_MASH' })
      sound.play('mash')
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const s = stateRef.current
      if (s.phase === 'battle' && s.battle && s.battle.phase === 'mash') {
        e.preventDefault()
        if (!e.repeat) mash()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mash])

  const startGame = useCallback((difficulty: Difficulty) => {
    sound.play('click')
    dispatch({ type: 'NEW_GAME', difficulty, setup: createInitialGame() })
  }, [])

  const restart = useCallback(() => {
    startGame(stateRef.current.difficulty)
  }, [startGame])

  const setDifficulty = useCallback(
    (difficulty: Difficulty) => {
      startGame(difficulty)
    },
    [startGame],
  )

  const playCard = useCallback((cardId: string) => {
    dispatch({ type: 'PLAYER_PLAY', cardId })
  }, [])

  const drawCardAction = useCallback(() => {
    dispatch({ type: 'PLAYER_DRAW' })
  }, [])

  const keepDrawn = useCallback(() => {
    sound.play('click')
    dispatch({ type: 'KEEP_DRAWN' })
  }, [])

  const toggleSound = useCallback(() => {
    const next = !stateRef.current.soundOn
    dispatch({ type: 'TOGGLE_SOUND' })
    sound.setMuted(!next)
    if (next) sound.play('click')
  }, [])

  const resetStats = useCallback(() => {
    sound.play('click')
    dispatch({ type: 'RESET_STATS' })
  }, [])

  const topCard = useMemo<UnoCard | null>(
    () => (state.discard.length > 0 ? state.discard[state.discard.length - 1] : null),
    [state.discard],
  )

  const isCardPlayableNow = useCallback(
    (card: UnoCard) => {
      if (state.phase !== 'player-turn' || state.turn !== 'player') return false
      if (state.pendingDraw) return card.id === state.pendingDraw && isPlayable(card, topCard)
      return isPlayable(card, topCard)
    },
    [state.phase, state.turn, state.pendingDraw, topCard],
  )

  return {
    state,
    topCard,
    startGame,
    restart,
    setDifficulty,
    playCard,
    drawCard: drawCardAction,
    keepDrawn,
    mash,
    toggleSound,
    resetStats,
    isCardPlayableNow,
  }
}
