'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import { BANNER_MS, isPlayable } from '@/lib/uno/engine'
import {
  PVP_EVENT,
  PVP_SERVICE_PORT,
  type PvpAck,
  type PvpAckError,
  type PvpRoomView,
} from '@/lib/uno/pvp-protocol'
import { sound } from '@/lib/uno/sound'
import { loadPvpStats, savePvpStats, type PvpStats } from '@/lib/uno/stats'
import type { ChaosBannerInfo, UnoCard } from '@/lib/uno/types'

// ─────────────────────────────────────────────────────────────
// Lobby error copy
// ─────────────────────────────────────────────────────────────

const ACK_ERRORS: Record<PvpAckError, string> = {
  'invalid-name': 'Name must be 1–12 characters!',
  'invalid-code': 'Room codes are 4 letters or digits!',
  'not-found': 'Room not found — check the code!',
  full: 'That room is already full!',
  error: 'Something went wrong — try again.',
}

// ─────────────────────────────────────────────────────────────
// The hook — a thin, server-driven client. ALL state comes from
// `room:state` snapshots; local logic only handles sounds, the
// chaos banner dismissal, screen shake and the PvP record.
// ─────────────────────────────────────────────────────────────

export interface UnoPvpApi {
  /** current personalized room snapshot (null = not in a room) */
  view: PvpRoomView | null
  /** socket connected to the PvP service */
  connected: boolean
  /** waiting for a create/join ack */
  busy: boolean
  /** lobby error message (create/join/connection failures) */
  lobbyError: string | null
  /** locally-dismissed chaos banner */
  banner: ChaosBannerInfo | null
  /** online PvP career record */
  pvpStats: PvpStats
  /** lazily connects the socket (call when entering PvP mode) */
  connect: () => void
  createRoom: (name: string) => void
  joinRoom: (name: string, code: string) => void
  leaveRoom: () => void
  playCard: (cardId: string) => void
  drawCard: () => void
  keepDrawn: () => void
  mash: () => void
  rematch: () => void
  resetPvpStats: () => void
  clearLobbyError: () => void
  isCardPlayable: (card: UnoCard) => boolean
}

export function useUnoPvp(): UnoPvpApi {
  const [view, setView] = useState<PvpRoomView | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lobbyError, setLobbyError] = useState<string | null>(null)
  const [banner, setBanner] = useState<ChaosBannerInfo | null>(null)
  const [pvpStats, setPvpStats] = useState<PvpStats>(() => loadPvpStats())

  const socketRef = useRef<Socket | null>(null)
  const viewRef = useRef<PvpRoomView | null>(null)
  const statsRef = useRef<PvpStats>(pvpStats)
  /** set while we ourselves tear the socket down (leave / unmount) */
  const intentionalRef = useRef(false)
  const lastSoundLogIdRef = useRef(0)
  const lastBannerIdRef = useRef(0)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** room+gameId of a result already counted in the PvP record */
  const countedGameRef = useRef<string | null>(null)

  const setViewSync = useCallback((next: PvpRoomView | null) => {
    viewRef.current = next
    setView(next)
  }, [])

  // ── screen shake (DOM-direct, same trick as the CPU hook) ──
  const shakeScreen = useCallback(() => {
    const el = document.getElementById('uno-frenzy-shell')
    if (!el) return
    el.classList.remove('animate-screen-shake')
    // force reflow so the animation can restart on rapid events
    void el.offsetWidth
    el.classList.add('animate-screen-shake')
    setTimeout(() => el.classList.remove('animate-screen-shake'), 560)
  }, [])

  // ── chaos banner: show fresh ones, auto-dismiss after BANNER_MS ──
  const showBanner = useCallback((info: ChaosBannerInfo) => {
    lastBannerIdRef.current = info.id
    setBanner(info)
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    bannerTimerRef.current = setTimeout(() => setBanner(null), BANNER_MS)
  }, [])

  // ── the room:state handler: ALL derived work happens here ──
  const handleRoomState = useCallback(
    (next: PvpRoomView) => {
      const prev = viewRef.current

      // entering a different room → reset per-room trackers
      // (log ids / banner seq restart in every new room)
      if (!prev || prev.roomCode !== next.roomCode) {
        lastSoundLogIdRef.current = 0
        lastBannerIdRef.current = 0
      }

      // 1. sounds attached to fresh log entries
      for (const entry of next.log) {
        if (entry.id <= lastSoundLogIdRef.current) continue
        lastSoundLogIdRef.current = entry.id
        if (!entry.sound) continue
        // the win entry reaches BOTH players — the loser hears 'lose'
        if (entry.sound === 'win') {
          const iWon = next.gameOver !== null && next.gameOver.winner === next.you
          sound.play(iWon ? 'win' : 'lose')
        } else {
          sound.play(entry.sound)
        }
      }

      // 2. chaos banner + screen shake
      if (next.chaosBanner && next.chaosBanner.id !== lastBannerIdRef.current) {
        showBanner(next.chaosBanner)
      }
      if (prev && next.shakeSeq !== prev.shakeSeq) {
        shakeScreen()
      }

      // 3. battle transitions — 'go' sting + countdown beeps
      const b = next.battle
      const pb = prev?.battle ?? null
      if (b && b.phase === 'mash') {
        if (!pb || pb.phase === 'ready') sound.play('go')
        if (b.msLeft > 0 && b.msLeft % 1000 === 0 && pb?.msLeft !== b.msLeft) {
          sound.play('countdown')
        }
      }

      // 4. record the match result once per game
      if (next.phase === 'game-over' && next.gameOver) {
        const gameKey = `${next.roomCode}:${next.gameId}`
        if (countedGameRef.current !== gameKey) {
          countedGameRef.current = gameKey
          const won = next.gameOver.winner === next.you
          const updated: PvpStats = {
            wins: statsRef.current.wins + (won ? 1 : 0),
            losses: statsRef.current.losses + (won ? 0 : 1),
          }
          statsRef.current = updated
          setPvpStats(updated)
          savePvpStats(updated)
        }
      }

      setViewSync(next)
    },
    [setViewSync, shakeScreen, showBanner],
  )

  // ── lazy socket factory ─────────────────────────────────────
  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current) return socketRef.current
    intentionalRef.current = false

    const socket = io(`/?XTransformPort=${PVP_SERVICE_PORT}`, {
      // DO NOT change the path — Caddy uses it to forward to the service
      path: '/',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })

    socket.on('connect', () => {
      setConnected(true)
      setLobbyError(null)
    })
    socket.on('connect_error', () => {
      if (!viewRef.current) setLobbyError('Cannot reach the arena — the PvP service may be down.')
    })
    socket.on('disconnect', () => {
      setConnected(false)
      if (intentionalRef.current) return
      // unexpected drop while in a match — the server forfeits us
      if (viewRef.current) {
        setViewSync(null)
        setBanner(null)
        setLobbyError('Connection lost — the match was forfeited.')
      }
    })
    socket.on(PVP_EVENT.ROOM_STATE, handleRoomState)
    socket.on(PVP_EVENT.ROOM_ERROR, (message: string) => {
      setLobbyError(message || ACK_ERRORS.error)
      setBusy(false)
    })

    socketRef.current = socket
    return socket
  }, [handleRoomState, setViewSync])

  // unmount cleanup
  useEffect(() => {
    return () => {
      intentionalRef.current = true
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  // ── lobby actions ───────────────────────────────────────────
  const connect = useCallback(() => {
    ensureSocket()
  }, [ensureSocket])

  const createRoom = useCallback(
    (name: string) => {
      const socket = ensureSocket()
      setBusy(true)
      setLobbyError(null)
      socket.emit(PVP_EVENT.ROOM_CREATE, { name }, (ack: PvpAck) => {
        setBusy(false)
        if (!ack.ok) setLobbyError(ACK_ERRORS[ack.error ?? 'error'] ?? ACK_ERRORS.error)
      })
    },
    [ensureSocket],
  )

  const joinRoom = useCallback(
    (name: string, code: string) => {
      const socket = ensureSocket()
      setBusy(true)
      setLobbyError(null)
      socket.emit(PVP_EVENT.ROOM_JOIN, { name, roomCode: code }, (ack: PvpAck) => {
        setBusy(false)
        if (!ack.ok) setLobbyError(ACK_ERRORS[ack.error ?? 'error'] ?? ACK_ERRORS.error)
      })
    },
    [ensureSocket],
  )

  const leaveRoom = useCallback(() => {
    // leave the room but KEEP the socket alive — the lobby is
    // immediately reusable for the next match
    socketRef.current?.emit(PVP_EVENT.ROOM_LEAVE)
    setBusy(false)
    setViewSync(null)
    setBanner(null)
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
  }, [setViewSync])

  // ── in-match actions (the server validates everything) ──────
  const playCard = useCallback((cardId: string) => {
    socketRef.current?.emit(PVP_EVENT.GAME_PLAY, { cardId })
  }, [])

  const drawCard = useCallback(() => {
    socketRef.current?.emit(PVP_EVENT.GAME_DRAW)
  }, [])

  const keepDrawn = useCallback(() => {
    sound.play('click')
    socketRef.current?.emit(PVP_EVENT.GAME_KEEP)
  }, [])

  const mash = useCallback(() => {
    const v = viewRef.current
    if (v?.phase === 'battle' && v.battle && v.battle.phase === 'mash') {
      socketRef.current?.emit(PVP_EVENT.BATTLE_MASH)
      sound.play('mash')
    }
  }, [])

  const rematch = useCallback(() => {
    sound.play('click')
    socketRef.current?.emit(PVP_EVENT.GAME_REMATCH)
  }, [])

  const resetPvpStats = useCallback(() => {
    const cleared: PvpStats = { wins: 0, losses: 0 }
    statsRef.current = cleared
    setPvpStats(cleared)
    savePvpStats(cleared)
  }, [])

  const clearLobbyError = useCallback(() => setLobbyError(null), [])

  // SPACE bar mashes for whoever is in a live battle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const v = viewRef.current
      if (v?.phase === 'battle' && v.battle && v.battle.phase === 'mash') {
        e.preventDefault()
        if (!e.repeat) mash()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mash])

  const isCardPlayable = useCallback((card: UnoCard) => {
    const v = viewRef.current
    if (!v || v.phase !== 'playing' || v.turn !== v.you) return false
    if (v.pendingDrawn) return card.id === v.pendingDrawn.id && isPlayable(card, v.topCard)
    return isPlayable(card, v.topCard)
  }, [])

  return {
    view,
    connected,
    busy,
    lobbyError,
    banner,
    pvpStats,
    connect,
    createRoom,
    joinRoom,
    leaveRoom,
    playCard,
    drawCard,
    keepDrawn,
    mash,
    rematch,
    resetPvpStats,
    clearLobbyError,
    isCardPlayable,
  }
}
