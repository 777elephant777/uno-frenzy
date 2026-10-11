// ─────────────────────────────────────────────────────────────
// UNO FRENZY — PvP authoritative socket.io game server
// (mini-services/uno-pvp — bun + socket.io, port 3005)
//
// Runs the FULL UNO FRENZY ruleset authoritatively per room,
// mirroring the CPU-game reducer (src/hooks/use-uno-game.ts)
// exactly — with player NAMES instead of "You"/"CPU".
// All shared rules logic is imported from the app's pure
// engine modules (bun resolves the TS natively).
// ─────────────────────────────────────────────────────────────
import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'

import {
  BATTLE_MS,
  BATTLE_PENALTY,
  BATTLE_READY_MS,
  BATTLE_RESULT_MS,
  BATTLE_TIE_PENALTY,
  CHAOS_EVENT_META,
  FRENZY_PER_CARD,
  cardName,
  createInitialGame,
  isPlayable,
  makeRandomNumberCard,
  pickChaosEvent,
  shuffle,
} from '../../src/lib/uno/engine'
import {
  PVP_CARD_SOUNDS,
  PVP_EVENT,
  PVP_SERVICE_PORT,
  type PvpAck,
  type PvpBattleView,
  type PvpGameOverView,
  type PvpPhase,
  type PvpRoomView,
  type Seat,
} from '../../src/lib/uno/pvp-protocol'
import type {
  BattlePhase,
  ChaosBannerInfo,
  LogEntry,
  LogKind,
  SoundName,
  UnoCard,
} from '../../src/lib/uno/types'

// ─────────────────────────────────────────────────────────────
// Typed socket contract (from the shared protocol constants)
// ─────────────────────────────────────────────────────────────

type ClientToServerEvents = {
  [PVP_EVENT.ROOM_CREATE]: (payload: { name: string }, ack: (res: PvpAck) => void) => void
  [PVP_EVENT.ROOM_JOIN]: (
    payload: { name: string; roomCode: string },
    ack: (res: PvpAck) => void,
  ) => void
  [PVP_EVENT.GAME_PLAY]: (payload: { cardId: string }) => void
  [PVP_EVENT.GAME_DRAW]: () => void
  [PVP_EVENT.GAME_KEEP]: () => void
  [PVP_EVENT.BATTLE_MASH]: () => void
  [PVP_EVENT.GAME_REMATCH]: () => void
  [PVP_EVENT.ROOM_LEAVE]: () => void
}

type ServerToClientEvents = {
  [PVP_EVENT.ROOM_STATE]: (view: PvpRoomView) => void
  [PVP_EVENT.ROOM_ERROR]: (message: string) => void
}

interface SocketData {
  roomCode: string | null
  seat: Seat | null
}

type PvpSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

// ─────────────────────────────────────────────────────────────
// Room state
// ─────────────────────────────────────────────────────────────

interface BattleTimers {
  ready: ReturnType<typeof setTimeout> | null
  tick: ReturnType<typeof setInterval> | null
  result: ReturnType<typeof setTimeout> | null
}

/** live sudden-card-battle state (serialized into PvpBattleView) */
interface RoomBattle {
  phase: BattlePhase
  msLeft: number
  scores: [number, number]
  winner: Seat | 'tie' | null
  initiator: Seat
  timers: BattleTimers
}

interface Room {
  code: string
  sockets: [PvpSocket | null, PvpSocket | null]
  names: [string, string]
  phase: PvpPhase
  /** increments per match — clients re-key hands for deal animations */
  gameId: number
  deck: UnoCard[]
  discard: UnoCard[]
  hands: [UnoCard[], UnoCard[]]
  turn: Seat
  /** chaos frenzy meter 0–100 */
  frenzy: number
  chaosPending: boolean
  chaosBanner: ChaosBannerInfo | null
  bannerSeq: number
  /** increments on every chaos event — clients shake the screen */
  shakeSeq: number
  shields: [boolean, boolean]
  pendingDrawn: [UnoCard | null, UnoCard | null]
  battle: RoomBattle | null
  gameOver: PvpGameOverView | null
  log: LogEntry[]
  logSeq: number
  /** scheduled "unplayable drawn card" auto-keeps, per seat */
  autoKeep: [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]
}

const rooms = new Map<string, Room>()

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no I L O 0 1
const CODE_LENGTH = 4
const LOG_CAP = 80
const AUTO_KEEP_MS = 1300

const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0)

function topCard(room: Room): UnoCard | null {
  return room.discard.length > 0 ? room.discard[room.discard.length - 1] : null
}

function pushLog(room: Room, text: string, kind: LogKind, sound?: SoundName): void {
  room.logSeq += 1
  room.log.push(sound ? { id: room.logSeq, text, kind, sound } : { id: room.logSeq, text, kind })
  if (room.log.length > LOG_CAP) room.log = room.log.slice(-LOG_CAP)
}

// ─────────────────────────────────────────────────────────────
// Deck / penalty helpers (mirror the CPU-game reducer)
// ─────────────────────────────────────────────────────────────

function drawCard(room: Room): UnoCard | null {
  if (room.deck.length === 0) {
    if (room.discard.length <= 1) return null
    const top = room.discard[room.discard.length - 1]
    room.deck = shuffle(room.discard.slice(0, -1))
    room.discard = [top]
    pushLog(room, 'Deck empty — discard pile blasts back into the deck!', 'info', 'swap')
  }
  return room.deck.shift() ?? null
}

function applyPenalty(room: Room, seat: Seat, count: number): void {
  const name = room.names[seat]
  if (room.shields[seat]) {
    room.shields[seat] = false
    pushLog(room, 'SHIELD absorbs the attack — no cards drawn!', 'shield', 'shield')
    return
  }
  let drawn = 0
  for (let i = 0; i < count; i += 1) {
    const card = drawCard(room)
    if (!card) break
    room.hands[seat].push(card)
    drawn += 1
  }
  if (drawn > 0) {
    pushLog(room, `${name} draws ${drawn} card${drawn === 1 ? '' : 's'}!`, 'penalty', 'penalty')
  } else {
    pushLog(room, `${name} would draw, but every card is in play!`, 'info')
  }
}

// ─────────────────────────────────────────────────────────────
// Timer teardown helpers (every callback is also state-guarded)
// ─────────────────────────────────────────────────────────────

function clearBattleTimers(battle: RoomBattle | null): void {
  if (!battle) return
  if (battle.timers.ready) clearTimeout(battle.timers.ready)
  if (battle.timers.tick) clearInterval(battle.timers.tick)
  if (battle.timers.result) clearTimeout(battle.timers.result)
  battle.timers.ready = null
  battle.timers.tick = null
  battle.timers.result = null
}

function clearAutoKeep(room: Room, seat?: Seat): void {
  if (seat === undefined) {
    clearAutoKeep(room, 0)
    clearAutoKeep(room, 1)
    return
  }
  if (room.autoKeep[seat]) clearTimeout(room.autoKeep[seat])
  room.autoKeep[seat] = null
}

// ─────────────────────────────────────────────────────────────
// Chaos Frenzy (mirror APPLY_CHAOS — randomness lives here)
// ─────────────────────────────────────────────────────────────

function tryResolveChaos(room: Room): void {
  // defer while a battle runs or the match is over — re-checked
  // after every mutation and when a battle closes
  if (!room.chaosPending || room.phase !== 'playing') return
  room.chaosPending = false

  const event = pickChaosEvent()
  const meta = CHAOS_EVENT_META[event]
  room.bannerSeq += 1
  room.chaosBanner = { id: room.bannerSeq, name: meta.name, description: meta.description }
  room.shakeSeq += 1
  pushLog(room, `CHAOS EVENT: ${meta.name} — ${meta.description}`, 'chaos', 'chaos')

  if (event === 'draw-rain') {
    applyPenalty(room, 0, 2)
    applyPenalty(room, 1, 2)
  } else if (event === 'reshuffle') {
    const shuffled = shuffle([...room.deck, ...room.discard.slice(0, -1)])
    if (shuffled.length > 0) {
      room.deck = shuffled
      room.discard = room.discard.length > 0 ? [room.discard[room.discard.length - 1]] : []
      pushLog(room, `Deck rebuilt — ${room.deck.length} cards ready.`, 'info')
    }
  } else {
    // top card morph
    const morph =
      room.deck.length > 0
        ? room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0]
        : makeRandomNumberCard()
    const oldTop = room.discard.pop()
    if (oldTop) room.deck.push(oldTop)
    room.discard.push(morph)
    pushLog(room, `The top card morphs into ${cardName(morph)}!`, 'chaos')
  }
}

// ─────────────────────────────────────────────────────────────
// Card effects (mirror the reducer's playCard exactly)
// ─────────────────────────────────────────────────────────────

function applyPlay(room: Room, seat: Seat, card: UnoCard): void {
  const name = room.names[seat]
  const opp = other(seat)

  // remove from hand → top of discard
  room.hands[seat] = room.hands[seat].filter((c) => c.id !== card.id)
  room.discard.push(card)
  if (room.pendingDrawn[seat]?.id === card.id) {
    room.pendingDrawn[seat] = null
    clearAutoKeep(room, seat)
  }

  const remaining = room.hands[seat].length

  pushLog(room, `${name} plays ${cardName(card)}!`, 'play', PVP_CARD_SOUNDS[card.kind])

  // chaos frenzy meter
  room.frenzy += FRENZY_PER_CARD
  if (room.frenzy >= 100) {
    room.frenzy -= 100
    room.chaosPending = true
  }

  // UNO shout
  if (remaining === 1) {
    pushLog(room, `${name} SHOUTS UNO!`, 'info', 'uno')
  }

  // WIN — first to empty their hand (pending effects are void)
  if (remaining === 0) {
    clearBattleTimers(room.battle)
    room.battle = null
    room.phase = 'game-over'
    room.gameOver = { winner: seat, reason: 'empty-hand' }
    room.pendingDrawn = [null, null]
    clearAutoKeep(room)
    pushLog(room, `${name} WINS! Empty hand — FRENZY MASTER!`, 'win', 'win')
    return
  }

  // card effects
  switch (card.kind) {
    case 'number':
      room.turn = opp
      break
    case 'skip':
      pushLog(room, `${room.names[opp]} is SKIPPED — ${name} goes again!`, 'info')
      room.turn = seat
      break
    case 'reverse':
      pushLog(room, 'REVERSE — the turn bounces right back!', 'info')
      room.turn = seat
      break
    case 'draw2':
      applyPenalty(room, opp, 2)
      pushLog(room, `${room.names[opp]} is SKIPPED — ${name} goes again!`, 'info')
      room.turn = seat
      break
    case 'draw4':
      applyPenalty(room, opp, 4)
      pushLog(room, `${room.names[opp]} is SKIPPED — ${name} goes again!`, 'info')
      room.turn = seat
      break
    case 'swap': {
      const swapped = room.hands[0]
      room.hands[0] = room.hands[1]
      room.hands[1] = swapped
      pushLog(room, 'HANDS SWAPPED — chaos reigns!', 'chaos', 'swap')
      room.turn = opp
      break
    }
    case 'wildfire':
      pushLog(room, 'WILDFIRE — everyone draws 1!', 'chaos', 'wildfire')
      applyPenalty(room, 0, 1)
      applyPenalty(room, 1, 1)
      room.turn = opp
      break
    case 'shield':
      room.shields[seat] = true
      pushLog(room, `${name} raises a SHIELD!`, 'shield', 'shield')
      room.turn = opp
      break
    case 'battle':
      pushLog(room, 'SUDDEN CARD BATTLE! MASH TO WIN!', 'battle', 'battle')
      startBattle(room, seat)
      break
  }
}

// ─────────────────────────────────────────────────────────────
// Sudden Card Battle lifecycle (server timers, guarded callbacks)
// ─────────────────────────────────────────────────────────────

function startBattle(room: Room, initiator: Seat): void {
  room.phase = 'battle'
  const battle: RoomBattle = {
    phase: 'ready',
    msLeft: BATTLE_MS,
    scores: [0, 0],
    winner: null,
    initiator,
    timers: { ready: null, tick: null, result: null },
  }
  room.battle = battle

  battle.timers.ready = setTimeout(() => {
    if (room.battle !== battle || room.phase !== 'battle') return
    battle.phase = 'mash'
    broadcast(room)

    battle.timers.tick = setInterval(() => {
      if (room.battle !== battle || room.phase !== 'battle') {
        clearBattleTimers(battle)
        return
      }
      battle.msLeft = Math.max(0, battle.msLeft - 100)
      if (battle.msLeft <= 0) {
        if (battle.timers.tick) clearInterval(battle.timers.tick)
        battle.timers.tick = null
        resolveBattle(room, battle)
      }
      broadcast(room)
    }, 100)
  }, BATTLE_READY_MS)
}

function resolveBattle(room: Room, battle: RoomBattle): void {
  battle.phase = 'result'
  const [a, b] = battle.scores
  const result: Seat | 'tie' = a === b ? 'tie' : a > b ? 0 : 1
  battle.winner = result

  if (result === 'tie') {
    pushLog(room, `BATTLE TIE ${a}—${b}!`, 'battle', 'penalty')
    applyPenalty(room, 0, BATTLE_TIE_PENALTY)
    applyPenalty(room, 1, BATTLE_TIE_PENALTY)
  } else {
    const winner: Seat = result
    const loser = other(winner)
    pushLog(
      room,
      `${room.names[winner]} WINS THE BATTLE ${battle.scores[winner]}—${battle.scores[loser]}!`,
      'battle',
      'battle',
    )
    applyPenalty(room, loser, BATTLE_PENALTY)
  }

  battle.timers.result = setTimeout(() => {
    if (room.battle !== battle || room.phase !== 'battle') return
    clearBattleTimers(battle)
    room.battle = null
    room.phase = 'playing'
    room.turn = other(battle.initiator)
    tryResolveChaos(room)
    broadcast(room)
  }, BATTLE_RESULT_MS)
}

// ─────────────────────────────────────────────────────────────
// Match / room lifecycle
// ─────────────────────────────────────────────────────────────

function newMatch(room: Room, rematch: boolean): void {
  clearBattleTimers(room.battle)
  room.battle = null
  clearAutoKeep(room)

  const setup = createInitialGame()
  room.deck = setup.deck
  room.discard = [setup.top]
  room.hands = [setup.playerHand, setup.aiHand]
  room.turn = Math.random() < 0.5 ? 0 : 1
  room.gameId += 1
  room.phase = 'playing'
  room.frenzy = 0
  room.chaosPending = false
  room.chaosBanner = null
  room.shields = [false, false]
  room.pendingDrawn = [null, null]
  room.gameOver = null
  room.log = []
  if (rematch) pushLog(room, 'REMATCH!', 'info', 'click')
  pushLog(room, `${room.names[0]} VS ${room.names[1]} — ${room.names[room.turn]} GOES FIRST!`, 'info')
}

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

function allocateRoomCode(): string {
  let code = generateRoomCode()
  while (rooms.has(code)) code = generateRoomCode()
  return code
}

function createRoom(host: PvpSocket, name: string): Room {
  const room: Room = {
    code: allocateRoomCode(),
    sockets: [host, null],
    names: [name, ''],
    phase: 'waiting',
    gameId: 0,
    deck: [],
    discard: [],
    hands: [[], []],
    turn: 0,
    frenzy: 0,
    chaosPending: false,
    chaosBanner: null,
    bannerSeq: 0,
    shakeSeq: 0,
    shields: [false, false],
    pendingDrawn: [null, null],
    battle: null,
    gameOver: null,
    log: [],
    logSeq: 0,
    autoKeep: [null, null],
  }
  rooms.set(room.code, room)
  return room
}

function destroyRoom(room: Room): void {
  clearBattleTimers(room.battle)
  room.battle = null
  clearAutoKeep(room)
  room.sockets = [null, null]
  rooms.delete(room.code)
}

function getRoomSeat(socket: PvpSocket): { room: Room; seat: Seat } | null {
  const { roomCode, seat } = socket.data
  if (!roomCode || seat === null) return null
  const room = rooms.get(roomCode)
  if (!room) return null
  if (room.sockets[seat] !== socket) return null
  return { room, seat }
}

function keepDrawn(room: Room, seat: Seat, auto: boolean): void {
  room.pendingDrawn[seat] = null
  clearAutoKeep(room, seat)
  pushLog(room, auto ? 'No match — turn passes.' : `${room.names[seat]} keeps the drawn card.`, 'info')
  room.turn = other(seat)
  tryResolveChaos(room)
  broadcast(room)
}

// ─────────────────────────────────────────────────────────────
// Leave / disconnect — forfeit handling
// ─────────────────────────────────────────────────────────────

function handleLeave(socket: PvpSocket): void {
  const ctx = getRoomSeat(socket)
  if (!ctx) return
  const { room, seat } = ctx

  socket.data.roomCode = null
  socket.data.seat = null

  if (room.phase === 'waiting') {
    // lobby cancelled before a challenger arrived — only the host is in
    destroyRoom(room)
    console.log(`[uno-pvp] room ${room.code} destroyed (lobby cancelled by ${room.names[seat]})`)
    return
  }

  if (room.phase === 'game-over') {
    // match already finished — leaving only updates presence,
    // it never rewrites an already-decided result
    room.sockets[seat] = null
    if (!room.sockets[0] && !room.sockets[1]) {
      destroyRoom(room)
      console.log(`[uno-pvp] room ${room.code} destroyed (empty after game-over)`)
      return
    }
    broadcast(room)
    return
  }

  // leaving a live match = forfeit
  clearBattleTimers(room.battle)
  room.battle = null
  clearAutoKeep(room)
  room.pendingDrawn = [null, null]
  room.phase = 'game-over'
  room.gameOver = { winner: other(seat), reason: 'forfeit' }
  room.sockets[seat] = null
  pushLog(room, `${room.names[seat]} LEFT THE MATCH — FORFEIT!`, 'win', 'win')

  if (!room.sockets[0] && !room.sockets[1]) {
    destroyRoom(room)
    console.log(`[uno-pvp] room ${room.code} destroyed (last player left)`)
    return
  }
  broadcast(room)
  console.log(`[uno-pvp] ${room.names[seat]} left room ${room.code} mid-match — forfeit`)
}

// ─────────────────────────────────────────────────────────────
// Personalized room view (one per connected socket)
// ─────────────────────────────────────────────────────────────

function viewFor(room: Room, seat: Seat): PvpRoomView {
  const opp = other(seat)
  let battle: PvpBattleView | null = null
  if (room.battle) {
    const scores: [number, number] = [room.battle.scores[0], room.battle.scores[1]]
    battle = {
      phase: room.battle.phase,
      msLeft: room.battle.msLeft,
      scores,
      winner: room.battle.winner,
    }
  }
  const gameOver: PvpGameOverView | null = room.gameOver
    ? { winner: room.gameOver.winner, reason: room.gameOver.reason }
    : null
  return {
    roomCode: room.code,
    you: seat,
    names: [room.names[0], room.names[1]],
    phase: room.phase,
    turn: room.turn,
    hand: room.hands[seat],
    opponentCardCount: room.hands[opp].length,
    topCard: topCard(room),
    deckCount: room.deck.length,
    frenzy: room.frenzy,
    shields: [room.shields[0], room.shields[1]],
    pendingDrawn: room.pendingDrawn[seat],
    opponentDeciding: room.pendingDrawn[opp] !== null,
    battle,
    gameOver,
    opponentConnected: room.sockets[opp] !== null,
    gameId: room.gameId,
    log: room.log,
    chaosBanner: room.chaosBanner,
    shakeSeq: room.shakeSeq,
  }
}

function broadcast(room: Room): void {
  for (const seat of [0, 1] as const) {
    const socket = room.sockets[seat]
    if (socket) socket.emit(PVP_EVENT.ROOM_STATE, viewFor(room, seat))
  }
}

// ─────────────────────────────────────────────────────────────
// Input sanitation
// ─────────────────────────────────────────────────────────────

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  if (cleaned.length < 1 || cleaned.length > 12) return null
  return cleaned
}

function ackSender(ack: unknown): (res: PvpAck) => void {
  return (res) => {
    if (typeof ack === 'function') ack(res)
  }
}

// ─────────────────────────────────────────────────────────────
// Server setup (same pattern as examples/websocket/server.ts)
// ─────────────────────────────────────────────────────────────

const httpServer = createServer()
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  {
    // DO NOT change the path, it is used by Caddy to forward the request to the correct port
    path: '/',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  },
)

io.on('connection', (socket) => {
  socket.data.roomCode = null
  socket.data.seat = null
  console.log(`[uno-pvp] socket ${socket.id} connected (${io.engine.clientsCount} online)`)

  socket.on(PVP_EVENT.ROOM_CREATE, (payload, ack) => {
    const respond = ackSender(ack)
    if (getRoomSeat(socket)) handleLeave(socket) // safety: one room per socket
    const name = sanitizeName(payload?.name)
    if (!name) {
      respond({ ok: false, error: 'invalid-name' })
      return
    }
    const room = createRoom(socket, name)
    socket.data.roomCode = room.code
    socket.data.seat = 0
    socket.emit(PVP_EVENT.ROOM_STATE, viewFor(room, 0))
    respond({ ok: true, roomCode: room.code })
    console.log(`[uno-pvp] ${name} created room ${room.code}`)
  })

  socket.on(PVP_EVENT.ROOM_JOIN, (payload, ack) => {
    const respond = ackSender(ack)
    if (getRoomSeat(socket)) handleLeave(socket) // safety: one room per socket
    const rawCode = typeof payload?.roomCode === 'string' ? payload.roomCode : ''
    const code = rawCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{4}$/.test(code)) {
      respond({ ok: false, error: 'invalid-code' })
      return
    }
    const room = rooms.get(code)
    if (!room) {
      respond({ ok: false, error: 'not-found' })
      return
    }
    if (room.sockets[1] !== null) {
      respond({ ok: false, error: 'full' })
      return
    }
    const name = sanitizeName(payload?.name)
    if (!name) {
      respond({ ok: false, error: 'invalid-name' })
      return
    }
    room.sockets[1] = socket
    room.names[1] = name
    socket.data.roomCode = room.code
    socket.data.seat = 1
    newMatch(room, false)
    broadcast(room)
    respond({ ok: true })
    console.log(`[uno-pvp] ${name} joined room ${room.code} — match started (game #${room.gameId})`)
  })

  socket.on(PVP_EVENT.GAME_PLAY, (payload) => {
    const ctx = getRoomSeat(socket)
    if (!ctx) return
    const { room, seat } = ctx
    const cardId = typeof payload?.cardId === 'string' ? payload.cardId : ''
    if (!cardId) return
    if (room.phase !== 'playing' || room.turn !== seat) return
    const card = room.hands[seat].find((c) => c.id === cardId)
    if (!card) return
    const pending = room.pendingDrawn[seat]
    if (pending !== null && pending.id !== card.id) return
    if (!isPlayable(card, topCard(room))) return

    applyPlay(room, seat, card)
    tryResolveChaos(room)
    broadcast(room)
  })

  socket.on(PVP_EVENT.GAME_DRAW, () => {
    const ctx = getRoomSeat(socket)
    if (!ctx) return
    const { room, seat } = ctx
    if (room.phase !== 'playing' || room.turn !== seat || room.pendingDrawn[seat] !== null) return

    const card = drawCard(room)
    if (!card) {
      pushLog(room, `${room.names[seat]} has no cards to draw — turn passes.`, 'info')
      room.turn = other(seat)
      tryResolveChaos(room)
      broadcast(room)
      return
    }
    room.hands[seat].push(card)
    room.pendingDrawn[seat] = card
    pushLog(room, `${room.names[seat]} draws a card.`, 'info', 'draw')

    // unplayable drawn card auto-passes after a short beat
    if (!isPlayable(card, topCard(room))) {
      const cardId = card.id
      room.autoKeep[seat] = setTimeout(() => {
        if (room.phase !== 'playing' || room.pendingDrawn[seat]?.id !== cardId) return
        keepDrawn(room, seat, true)
      }, AUTO_KEEP_MS)
    }
    tryResolveChaos(room)
    broadcast(room)
  })

  socket.on(PVP_EVENT.GAME_KEEP, () => {
    const ctx = getRoomSeat(socket)
    if (!ctx) return
    const { room, seat } = ctx
    if (room.phase !== 'playing' || room.pendingDrawn[seat] === null) return
    keepDrawn(room, seat, false)
  })

  socket.on(PVP_EVENT.BATTLE_MASH, () => {
    const ctx = getRoomSeat(socket)
    if (!ctx) return
    const { room, seat } = ctx
    const battle = room.battle
    if (!battle || room.phase !== 'battle' || battle.phase !== 'mash') return
    battle.scores[seat] += 1
    broadcast(room)
  })

  socket.on(PVP_EVENT.GAME_REMATCH, () => {
    const ctx = getRoomSeat(socket)
    if (!ctx) return
    const { room } = ctx
    if (room.phase !== 'game-over') return
    if (!room.sockets[0] || !room.sockets[1]) return
    newMatch(room, true)
    broadcast(room)
  })

  socket.on(PVP_EVENT.ROOM_LEAVE, () => handleLeave(socket))

  socket.on('disconnect', () => {
    console.log(`[uno-pvp] socket ${socket.id} disconnected`)
    handleLeave(socket)
  })
})

httpServer.listen(PVP_SERVICE_PORT, () => {
  console.log(`UNO FRENZY PvP server running on port ${PVP_SERVICE_PORT} (socket.io path "/")`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down PvP server...')
  for (const room of rooms.values()) destroyRoom(room)
  httpServer.close(() => {
    console.log('UNO FRENZY PvP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down PvP server...')
  for (const room of rooms.values()) destroyRoom(room)
  httpServer.close(() => {
    console.log('UNO FRENZY PvP server closed')
    process.exit(0)
  })
})
