'use client'

import { useEffect, useRef } from 'react'
import { ScrollText } from 'lucide-react'

import type { LogEntry, LogKind } from '@/lib/uno/types'

const LOG_COLORS: Record<LogKind, string> = {
  info: '#fffdf5',
  play: '#ffd600',
  penalty: '#ff6b61',
  chaos: '#ff9500',
  battle: '#ffffff',
  shield: '#e5e7eb',
  win: '#4ade80',
}

export function BattleLog({ entries, emptyHint }: { entries: LogEntry[]; emptyHint?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the newest entry (bottom).
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  return (
    <footer className="mt-auto w-full border-t-4 border-black bg-[#0a0a0a]">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <ScrollText className="size-4 shrink-0 text-[#ffea00]" strokeWidth={2.5} />
          <h2 className="font-display text-xs tracking-[0.25em] text-[#ffea00]">BATTLE LOG</h2>
        </div>
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label="Battle log entries"
          className="brutal-scroll max-h-36 overflow-y-auto px-3 pb-2 sm:px-4"
        >
          {entries.length === 0 ? (
            <p className="py-2 text-sm font-bold text-[#e5e7eb]">
              {emptyHint ?? 'No battles yet — press START GAME.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="animate-slide-up text-sm leading-snug"
                  style={{ color: LOG_COLORS[entry.kind] }}
                >
                  <span className={entry.kind === 'battle' ? 'font-black' : 'font-bold'}>
                    ▸ {entry.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  )
}
