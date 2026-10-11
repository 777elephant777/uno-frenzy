'use client'

import { useState, type ReactNode } from 'react'
import {
  BarChart3,
  BookOpen,
  Bot,
  LogOut,
  RotateCcw,
  Skull,
  Smile,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'

import { BattleLog } from '@/components/uno/battle-log'
import { BattleModal } from '@/components/uno/battle-modal'
import { ChaosBanner } from '@/components/uno/chaos-banner'
import { GameBoard } from '@/components/uno/game-board'
import { GameOverModal } from '@/components/uno/game-over-modal'
import { PvpBattleModal } from '@/components/uno/pvp-battle-modal'
import { PvpGameBoard } from '@/components/uno/pvp-game-board'
import { PvpGameOverModal } from '@/components/uno/pvp-game-over-modal'
import { PvpLobby } from '@/components/uno/pvp-lobby'
import { RulesModal } from '@/components/uno/rules-modal'
import { StatsModal } from '@/components/uno/stats-modal'
import { useUnoGame } from '@/hooks/use-uno-game'
import { useUnoPvp } from '@/hooks/use-uno-pvp'
import { sound } from '@/lib/uno/sound'
import { DIFFICULTY_LABELS, type Difficulty } from '@/lib/uno/types'
import { cn } from '@/lib/utils'

type Mode = 'cpu' | 'pvp'

const DIFFICULTY_ORDER: Array<{ id: Difficulty; icon: typeof Smile; chip: string }> = [
  { id: 'easy', icon: Smile, chip: 'bg-white text-black' },
  { id: 'chaotic', icon: Zap, chip: 'bg-[#ff9500] text-black' },
  { id: 'insane', icon: Skull, chip: 'bg-[#ff3b30] text-white' },
]

function HeaderButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex items-center gap-1.5 rounded-md border-[3px] border-black bg-[#ffea00] px-2 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0_rgba(255,234,0,0.35)] transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5"
    >
      {children}
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

function ModeButton({
  active,
  disabled,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: typeof Bot
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? 'Battle in progress — hold on!' : label}
      className={cn(
        'font-display flex items-center gap-1.5 rounded-md border-[3px] border-black px-3 py-1.5 text-xs transition-all duration-150 sm:text-sm',
        active
          ? 'translate-x-[2px] translate-y-[2px] bg-black! text-[#ffea00]! shadow-none'
          : cn(
              'bg-white text-black shadow-[3px_3px_0_#0a0a0a]',
              !disabled && 'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0a0a0a]',
            ),
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <Icon className="size-4" strokeWidth={2.5} />
      {label}
    </button>
  )
}

export default function Home() {
  const game = useUnoGame()
  const pvp = useUnoPvp()
  const { state } = game

  const [mode, setMode] = useState<Mode>('cpu')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  const inGame = state.phase !== 'idle' && state.phase !== 'game-over'
  const pvpView = pvp.view
  const inPvpRoom = pvpView !== null
  const pvpPlaying = inPvpRoom && pvpView.phase !== 'waiting'

  // never let a player abandon a live Sudden Card Battle by switching modes
  const modeLocked = state.phase === 'battle' || pvpView?.phase === 'battle'

  const switchMode = (next: Mode) => {
    if (next === mode || modeLocked) return
    sound.play('click')
    if (mode === 'pvp' && inPvpRoom) {
      // leaving a live match forfeits it — the opponent gets the win
      pvp.leaveRoom()
    }
    if (next === 'pvp') pvp.connect()
    setMode(next)
  }

  const resetAllStats = () => {
    game.resetStats()
    pvp.resetPvpStats()
  }

  const openModal = (setter: (open: boolean) => void) => () => {
    sound.play('click')
    setter(true)
  }

  const logEntries = mode === 'pvp' ? (pvpView?.log ?? []) : state.log

  return (
    <div className="bg-arcade flex min-h-screen flex-col">
      <div id="uno-frenzy-shell" className="flex min-h-screen flex-col">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="border-b-4 border-black bg-[#0a0a0a]">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
            <h1 className="font-display flex items-center gap-2 text-xl text-[#ffea00] sm:gap-2.5 sm:text-2xl">
              <span className="flex size-8 rotate-[-4deg] items-center justify-center rounded-md border-[3px] border-black bg-[#ffea00] sm:size-9">
                <Zap className="size-5 text-black" strokeWidth={2.5} fill="#0a0a0a" />
              </span>
              UNO FRENZY
            </h1>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <HeaderButton label="Rules" onClick={openModal(setRulesOpen)}>
                <BookOpen className="size-4" strokeWidth={2.5} />
              </HeaderButton>
              <HeaderButton label="Stats" onClick={openModal(setStatsOpen)}>
                <BarChart3 className="size-4" strokeWidth={2.5} />
              </HeaderButton>
              <HeaderButton label={state.soundOn ? 'Sound on' : 'Sound off'} onClick={game.toggleSound}>
                {state.soundOn ? (
                  <Volume2 className="size-4" strokeWidth={2.5} />
                ) : (
                  <VolumeX className="size-4" strokeWidth={2.5} />
                )}
              </HeaderButton>
              {mode === 'cpu' && (
                <HeaderButton label="Restart game" onClick={game.restart} disabled={!inGame}>
                  <RotateCcw className="size-4" strokeWidth={2.5} />
                </HeaderButton>
              )}
            </div>
          </div>
        </header>

        {/* ── Mode / difficulty toolbar ─────────────────── */}
        <div className="border-b-4 border-black bg-[#ffd600]">
          <div
            role="toolbar"
            aria-label="Game mode and difficulty"
            className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4"
          >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="font-display text-xs tracking-widest">MODE</span>
              <ModeButton
                active={mode === 'cpu'}
                disabled={modeLocked}
                onClick={() => switchMode('cpu')}
                icon={Bot}
                label="VS CPU"
              />
              <ModeButton
                active={mode === 'pvp'}
                disabled={modeLocked}
                onClick={() => switchMode('pvp')}
                icon={Users}
                label="VS PLAYER"
              />
            </div>

            {mode === 'cpu' ? (
              <div
                role="group"
                aria-label="Difficulty selector"
                className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
              >
                <span className="font-display text-xs tracking-widest">DIFFICULTY</span>
                {DIFFICULTY_ORDER.map(({ id, icon: Icon, chip }) => {
                  const active = state.difficulty === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => game.setDifficulty(id)}
                      aria-pressed={active}
                      title={active ? 'Current difficulty' : 'Switch (restarts the game instantly)'}
                      className={cn(
                        'font-display flex items-center gap-1.5 rounded-md border-[3px] border-black px-3 py-1.5 text-xs transition-all duration-150 sm:text-sm',
                        active
                          ? 'translate-x-[2px] translate-y-[2px] bg-black! text-[#ffea00]! shadow-none'
                          : cn(
                              chip,
                              'shadow-[3px_3px_0_#0a0a0a] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0a0a0a]',
                            ),
                      )}
                    >
                      <Icon className="size-4" strokeWidth={2.5} />
                      {DIFFICULTY_LABELS[id]}
                    </button>
                  )
                })}
              </div>
            ) : inPvpRoom ? (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <span className="font-display flex items-center rounded-md border-[3px] border-black bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-[#ffea00] shadow-[3px_3px_0_#0a0a0a]">
                  ROOM {pvpView.roomCode}
                </span>
                {pvpPlaying && (
                  <span className="font-display hidden rounded-md border-[3px] border-black bg-white px-2.5 py-1.5 text-xs shadow-[3px_3px_0_#0a0a0a] sm:flex">
                    {pvpView.names[0]} VS {pvpView.names[1]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={pvp.leaveRoom}
                  title="Leave the match (forfeits a live game)"
                  className="font-display flex items-center gap-1 rounded-md border-[3px] border-black bg-[#ff3b30] px-2.5 py-1.5 text-xs text-white shadow-[3px_3px_0_#0a0a0a] transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  <LogOut className="size-3.5" strokeWidth={2.5} />
                  LEAVE
                </button>
              </div>
            ) : (
              <span className="font-display text-[10px] tracking-widest text-black/70 sm:text-xs">
                ONLINE 1V1 — CREATE OR JOIN A MATCH
              </span>
            )}
          </div>
        </div>

        {/* ── Main table ─────────────────────────────────── */}
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4 p-3 sm:gap-5 sm:p-4 md:p-6">
          {mode === 'cpu' ? (
            <GameBoard game={game} />
          ) : !inPvpRoom || pvpView.phase === 'waiting' ? (
            <PvpLobby
              connected={pvp.connected}
              busy={pvp.busy}
              error={pvp.lobbyError}
              roomCode={pvpView?.roomCode ?? null}
              onCreate={pvp.createRoom}
              onJoin={pvp.joinRoom}
              onCancel={pvp.leaveRoom}
            />
          ) : (
            <PvpGameBoard
              view={pvpView}
              onPlay={pvp.playCard}
              onDraw={pvp.drawCard}
              onKeep={pvp.keepDrawn}
              isCardPlayable={pvp.isCardPlayable}
            />
          )}
        </main>

        {/* ── Battle log footer ──────────────────────────── */}
        <BattleLog
          entries={logEntries}
          emptyHint={mode === 'pvp' ? 'No matches yet — create or join a room.' : undefined}
        />
      </div>

      {/* ── Overlays ──────────────────────────────────────── */}
      <ChaosBanner info={mode === 'pvp' ? pvp.banner : state.chaosBanner} />

      {mode === 'cpu' ? (
        <>
          {state.battle && (
            <BattleModal
              open={state.phase === 'battle'}
              phase={state.battle.phase}
              msLeft={state.battle.msLeft}
              playerScore={state.battle.playerScore}
              aiScore={state.battle.aiScore}
              winner={state.battle.winner}
              difficulty={state.difficulty}
              onMash={game.mash}
            />
          )}
          <GameOverModal
            open={state.phase === 'game-over'}
            winner={state.winner ?? 'ai'}
            stats={state.stats}
            difficulty={state.difficulty}
            onPlayAgain={game.restart}
          />
        </>
      ) : (
        pvpView && (
          <>
            {pvpView.battle && (
              <PvpBattleModal
                open={pvpView.phase === 'battle'}
                phase={pvpView.battle.phase}
                msLeft={pvpView.battle.msLeft}
                myScore={pvpView.battle.scores[pvpView.you]}
                oppScore={pvpView.battle.scores[pvpView.you === 0 ? 1 : 0]}
                myName={pvpView.names[pvpView.you]}
                oppName={pvpView.names[pvpView.you === 0 ? 1 : 0]}
                winner={
                  pvpView.battle.winner === 'tie' || pvpView.battle.winner === null
                    ? pvpView.battle.winner
                    : pvpView.battle.winner === pvpView.you
                      ? 'you'
                      : 'opp'
                }
                onMash={pvp.mash}
              />
            )}
            <PvpGameOverModal
              open={pvpView.phase === 'game-over'}
              view={pvpView}
              onRematch={pvp.rematch}
              onLeave={pvp.leaveRoom}
            />
          </>
        )
      )}

      <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} />
      <StatsModal
        open={statsOpen}
        onOpenChange={setStatsOpen}
        stats={state.stats}
        pvpStats={pvp.pvpStats}
        onReset={resetAllStats}
      />
    </div>
  )
}
