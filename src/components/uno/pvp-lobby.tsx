'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, Users, X } from 'lucide-react'

import { Input } from '@/components/ui/input'

/** Brutal overrides stacked on top of the shadcn Input base classes */
const INPUT_BASE =
  'h-12 rounded-lg border-[4px] border-black bg-white px-3 font-bold shadow-[4px_4px_0_#0a0a0a] placeholder:text-black/40 focus-visible:border-black focus-visible:ring-black/30'

/** Shared action-button styling (brutal hover lift / active press) */
const ACTION_BUTTON_BASE =
  'font-display flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg border-[4px] border-black px-4 py-3 text-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 enabled:cursor-pointer enabled:hover:-translate-x-0.5 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[7px_7px_0_#0a0a0a] enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-60'

export function PvpLobby({
  connected,
  busy,
  error,
  roomCode,
  onCreate,
  onJoin,
  onCancel,
}: {
  connected: boolean
  busy: boolean
  error: string | null
  /** non-null → "waiting for challenger" state */
  roomCode: string | null
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const copyTimerRef = useRef<number | null>(null)

  const trimmedName = name.trim()
  const canJoin = trimmedName.length > 0 && code.length === 4

  const submitCreate = () => {
    if (busy) return
    // CREATE stays clickable with a blank name — fall back to the placeholder
    // so the server never receives an empty name.
    onCreate(trimmedName.length > 0 ? trimmedName : 'PLAYER 1')
  }

  const submitJoin = () => {
    if (busy || !canJoin) return
    onJoin(trimmedName, code)
  }

  const copyCode = async () => {
    if (!roomCode) return
    let ok = false
    try {
      await navigator.clipboard.writeText(roomCode)
      ok = true
    } catch {
      // Clipboard API unavailable — select the code inside a hidden input so
      // a legacy copy still has something to grab.
      const el = codeInputRef.current
      if (el) {
        el.focus()
        el.select()
        try {
          ok = document.execCommand('copy')
        } catch {
          ok = false
        }
      }
    }
    if (ok) {
      setCopied(true)
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
    }
  }

  // ── Connecting to the socket service ──────────────────────
  if (!connected) {
    return (
      <section aria-label="Connecting to the PvP arena" className="mx-auto w-full max-w-md">
        <div className="rounded-xl border-[5px] border-black bg-[#fffdf5] p-8 text-center shadow-[8px_8px_0_#0a0a0a] sm:p-10">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="size-7 animate-spin sm:size-8" strokeWidth={2.5} aria-hidden />
            <p className="font-display animate-pulse text-xl sm:text-2xl">CONNECTING TO THE ARENA…</p>
          </div>
          {error && (
            <div
              role="alert"
              className="animate-pop mt-4 flex items-center justify-center gap-2 rounded-md border-[3px] border-black bg-[#ff3b30] px-3 py-2 text-xs font-black text-white"
            >
              <AlertTriangle className="size-4 shrink-0" strokeWidth={2.5} />
              {error}
            </div>
          )}
        </div>
      </section>
    )
  }

  // ── Room created — waiting for the challenger ──────────────
  if (roomCode) {
    return (
      <section aria-label="Waiting for a challenger" className="mx-auto w-full max-w-md">
        <div className="rounded-xl border-[5px] border-black bg-[#fffdf5] p-6 text-center shadow-[8px_8px_0_#0a0a0a] sm:p-8">
          <p className="font-display text-xs tracking-[0.3em] text-black/70">ROOM CODE</p>
          <div className="animate-pop mx-auto mt-3 w-fit rounded-lg border-[4px] border-black bg-white px-5 py-2 shadow-[6px_6px_0_#0a0a0a] sm:px-7 sm:py-3">
            <p className="font-display pl-[0.3em] text-5xl leading-none tracking-[0.3em] sm:text-7xl">
              {roomCode}
            </p>
          </div>

          <span className="font-display mt-5 inline-flex animate-pulse items-center rounded-md border-[3px] border-black bg-[#ff9500] px-3 py-1 text-xs text-black shadow-[2px_2px_0_#0a0a0a]">
            WAITING FOR A CHALLENGER…
          </span>

          <p className="mt-4 text-sm font-bold text-black/70">
            Share this code with a friend — they pick JOIN MATCH on their device.
          </p>

          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={copyCode}
              aria-label="Copy the room code"
              className={`${ACTION_BUTTON_BASE} ${copied ? 'bg-[#22c55e]' : 'bg-[#ffea00]'} text-black`}
            >
              {copied ? (
                <Check className="size-5 shrink-0" strokeWidth={2.5} />
              ) : (
                <Copy className="size-5 shrink-0" strokeWidth={2.5} />
              )}
              {copied ? 'COPIED!' : 'COPY CODE'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={`${ACTION_BUTTON_BASE} bg-[#ff3b30] text-white`}
            >
              <X className="size-5 shrink-0" strokeWidth={2.5} />
              CANCEL
            </button>
          </div>

          {/* hidden mirror of the code — the copy fallback selects it */}
          <input ref={codeInputRef} readOnly value={roomCode} tabIndex={-1} aria-hidden="true" className="sr-only" />
        </div>
      </section>
    )
  }

  // ── Name + room-code form ─────────────────────────────────
  return (
    <section aria-label="Online match lobby" className="mx-auto w-full max-w-md">
      <div className="rounded-xl border-[5px] border-black bg-[#fffdf5] p-5 shadow-[8px_8px_0_#0a0a0a] sm:p-6">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border-[3px] border-black bg-[#0a0a0a] text-[#ffea00] sm:size-10">
            <Users className="size-5 sm:size-6" strokeWidth={2.5} />
          </span>
          <h2 className="font-display text-xl sm:text-2xl">VS PLAYER — ONLINE MATCH</h2>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pvp-name" className="font-display text-xs tracking-wider">
              YOUR NAME
            </label>
            <Input
              id="pvp-name"
              value={name}
              maxLength={12}
              placeholder="PLAYER 1"
              autoComplete="off"
              onChange={(e) => setName(e.target.value.slice(0, 12))}
              className={`${INPUT_BASE} text-base md:text-base`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pvp-code" className="font-display text-xs tracking-wider">
              ROOM CODE
            </label>
            <Input
              id="pvp-code"
              value={code}
              maxLength={4}
              placeholder="ABCD"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitJoin()
              }}
              className={`${INPUT_BASE} text-center text-xl font-black uppercase tracking-widest md:text-xl`}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={submitCreate}
            disabled={busy}
            className={`${ACTION_BUTTON_BASE} bg-[#ffea00] text-black shadow-[5px_5px_0_#0a0a0a]`}
          >
            <Users className="size-5 shrink-0" strokeWidth={2.5} />
            {busy ? '…' : 'CREATE MATCH'}
          </button>
          <button
            type="button"
            onClick={submitJoin}
            disabled={busy || !canJoin}
            className={`${ACTION_BUTTON_BASE} bg-white text-black shadow-[5px_5px_0_#0a0a0a]`}
          >
            {busy ? '…' : 'JOIN MATCH'}
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-wide text-black/60">
          2 PLAYERS · 2 DEVICES OR TABS · LEAVING A LIVE MATCH COUNTS AS A FORFEIT
        </p>

        {error && (
          <div
            role="alert"
            className="animate-pop mt-3 flex items-center justify-center gap-2 rounded-md border-[3px] border-black bg-[#ff3b30] px-3 py-2 text-xs font-black text-white"
          >
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2.5} />
            {error}
          </div>
        )}
      </div>
    </section>
  )
}
