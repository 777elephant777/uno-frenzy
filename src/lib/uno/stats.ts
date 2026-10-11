// ─────────────────────────────────────────────────────────────
// UNO FRENZY — Career stats + preferences in localStorage
// ─────────────────────────────────────────────────────────────
import { CareerStats } from './types'

const STATS_KEY = 'uno-frenzy-stats-v1'
const SOUND_KEY = 'uno-frenzy-sound-v1'
const PVP_STATS_KEY = 'uno-frenzy-pvp-stats-v1'

export const DEFAULT_STATS: CareerStats = {
  wins: 0,
  losses: 0,
  currentStreak: 0,
  bestStreak: 0,
  battlesWon: 0,
}

/** Online PvP career record (kept separate from the CPU career stats) */
export interface PvpStats {
  wins: number
  losses: number
}

export const DEFAULT_PVP_STATS: PvpStats = { wins: 0, losses: 0 }

function toInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

export function loadStats(): CareerStats {
  if (typeof window === 'undefined') return { ...DEFAULT_STATS }
  try {
    const raw = window.localStorage.getItem(STATS_KEY)
    if (!raw) return { ...DEFAULT_STATS }
    const parsed = JSON.parse(raw) as Partial<CareerStats>
    return {
      wins: toInt(parsed.wins),
      losses: toInt(parsed.losses),
      currentStreak: toInt(parsed.currentStreak),
      bestStreak: toInt(parsed.bestStreak),
      battlesWon: toInt(parsed.battlesWon),
    }
  } catch {
    return { ...DEFAULT_STATS }
  }
}

export function saveStats(stats: CareerStats): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // storage unavailable — stats stay in memory only
  }
}

export function loadSoundPref(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}

export function saveSoundPref(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SOUND_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}

export function loadPvpStats(): PvpStats {
  if (typeof window === 'undefined') return { ...DEFAULT_PVP_STATS }
  try {
    const raw = window.localStorage.getItem(PVP_STATS_KEY)
    if (!raw) return { ...DEFAULT_PVP_STATS }
    const parsed = JSON.parse(raw) as Partial<PvpStats>
    return {
      wins: toInt(parsed.wins),
      losses: toInt(parsed.losses),
    }
  } catch {
    return { ...DEFAULT_PVP_STATS }
  }
}

export function savePvpStats(stats: PvpStats): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PVP_STATS_KEY, JSON.stringify(stats))
  } catch {
    // storage unavailable — stats stay in memory only
  }
}
