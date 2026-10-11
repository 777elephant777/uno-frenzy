# UNO FRENZY — Project Worklog (shared by all agents)

Append sections below with the required template. NEVER overwrite existing content.

## Master Plan

| Task ID | Owner | Scope |
|---|---|---|
| 1 | main | Inspect project, create `src/lib/uno/types.ts` + this worklog |
| 2-a | subagent (frontend-styling-expert) | Modal & feedback components (6 files, see contracts) |
| 2-b | main | `src/lib/uno/engine.ts`, `sound.ts`, `stats.ts` |
| 3 | main | `src/hooks/use-uno-game.ts`, core UI (`game-card`, `chaos-meter`, `game-board`), `src/app/page.tsx`, globals.css additions |
| 4 | main | Lint + dev.log check + fixes |
| 5 | main | Agent-browser E2E verification + fixes |
| 6 | main | Final worklog + report |

## Game Rules Summary (implemented across tasks)

- ALL cards are yellow. Match by NUMBER value only, or play an ACTION card (action cards are always playable; if the top card is an action card, any number may be played).
- Deck: numbers 0–9 ×3, SKIP ×4, REVERSE ×4, +2 ×4, MEGA +4 ×3, SWAP ×3, WILDFIRE ×3, SHIELD ×3, BATTLE ×3 (57 cards).
- SKIP / REVERSE: in this 1v1, the player who played it goes again.
- +2 / MEGA +4: opponent draws (2/4) and is skipped → attacker goes again.
- SWAP: exchange hands. WILDFIRE: everyone draws 1. SHIELD: blocks the NEXT forced draw (from +2/+4/BATTLE penalty/WILDFIRE/Chaos draws), then breaks.
- BATTLE: 3-second mash mini-game — loser draws 4, tie → both draw 2.
- Chaos Frenzy Meter: +8% per card played; at 100% a random chaos event fires (DRAW RAIN = everyone draws 2 / DECK EXPLOSION = reshuffle / TOP CARD MORPH) with screen shake + banner.
- Win: empty your hand first. Stats (wins/losses/streaks/battles won) persist in localStorage.
- Difficulty affects AI reaction time, aggression, battle mash rate: EASY / CHAOTIC / INSANE.

## DESIGN SYSTEM (MANDATORY for every component)

- **Aesthetic**: neo-brutalist arcade. Flat colors, NO gradients, NO blur shadows.
- **Palette** (use exact hex): yellow-bright `#ffea00` (page bg), yellow-card `#ffd600` (card faces), ink `#0a0a0a` (borders/text), paper `#fffdf5` (panels), red `#ff3b30` (penalty/danger/insane), orange `#ff9500` (chaos/warning), green `#22c55e` (success). NO blue/indigo/purple anywhere.
- **Borders**: `border-[3px]`–`border-[6px] border-black`. Cards 3px, panels/modals 4–6px.
- **Hard shadows** (no blur): buttons `shadow-[4px_4px_0_#0a0a0a]`, cards/panels `shadow-[6px_6px_0_#0a0a0a]`, modals `shadow-[8px_8px_0_#0a0a0a]`. Hover: `-translate-x-0.5 -translate-y-0.5` + bigger shadow. Active/pressed: `translate-x-0.5 translate-y-0.5` + shadow-none.
- **Typography**: headings/buttons/values use the CSS class `font-display` (defined in globals.css: Impact / Arial Black stack, uppercase). Body text: default font, font-bold.
- **Icons**: lucide-react only, chunky `strokeWidth={2.5}`. NO emojis in UI text.
- **Radius**: `rounded-md` small, `rounded-lg` cards, `rounded-xl` panels/modals.
- **Custom CSS classes available** (defined in globals.css by Task 3): `.font-display`, `.bg-arcade`, `.brutal-scroll` (scrollbar), animations `.animate-pop`, `.animate-banner`, `.animate-deal`, `.animate-slide-up`, `.animate-pop-score`, `.animate-screen-shake`, `.animate-meter-pulse`.
- **Responsive**: mobile-first; modals `max-w-[92vw] sm:max-w-lg`, content `max-h-[70vh] overflow-y-auto brutal-scroll`.
- **Footer**: the BattleLog component renders the page footer — it must be a `<footer>` root with `mt-auto` so it sticks to the bottom (page wraps everything in `min-h-screen flex flex-col`).

## COMPONENT CONTRACTS — Task 2-a (subagent)

Shared types: `import { LogEntry, CareerStats, Difficulty, ChaosBannerInfo, BattlePhase, BattleWinner } from '@/lib/uno/types'`

### 1. `src/components/uno/rules-modal.tsx`
```tsx
export function RulesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void })
```
Full rulebook modal (content below). Use shadcn `Dialog` from `@/components/ui/dialog` (it exists). Custom brutal styling on DialogContent.

### 2. `src/components/uno/stats-modal.tsx`
```tsx
export function StatsModal({ open, onOpenChange, stats, onReset }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stats: CareerStats
  onReset: () => void
})
```
Stat blocks: WINS (green), LOSSES (red), CURRENT STREAK, BEST STREAK, BATTLES WON (orange), WIN RATE (computed, "—" when no games). Reset button = two-step confirm (click → "SURE?" → click again). Use shadcn Dialog.

### 3. `src/components/uno/game-over-modal.tsx`
```tsx
export function GameOverModal({ open, winner, stats, difficulty, onPlayAgain }: {
  open: boolean
  winner: 'player' | 'ai'
  stats: CareerStats
  difficulty: Difficulty
  onPlayAgain: () => void
})
```
Big "YOU WIN!" (Trophy icon, green accents) / "YOU LOSE..." (Skull icon, red accents). Shows difficulty label, updated career stat chips, and a giant PLAY AGAIN button. Use shadcn Dialog. Must NOT be closable via a cancel path that breaks the game — allow ESC/overlay close (harmless).

### 4. `src/components/uno/battle-modal.tsx`
```tsx
export function BattleModal({ open, phase, msLeft, playerScore, aiScore, winner, difficulty, onMash }: {
  open: boolean
  phase: BattlePhase            // 'ready' | 'mash' | 'result'
  msLeft: number                // 3000 → 0 during mash
  playerScore: number
  aiScore: number
  winner: BattleWinner          // null until result
  difficulty: Difficulty
  onMash: () => void
})
```
NOT a Dialog — render a hand-rolled full-screen overlay `fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4` only when `open`. Layout: header "SUDDEN CARD BATTLE!" (Swords icon), two score panels "YOU" vs "CPU ({difficulty})", a draining time bar (width % = msLeft/3000) + giant countdown seconds `Math.ceil(msLeft/1000)`, and a MASSIVE yellow "MASH!" button (`onPointerDown={onMash}`, disabled unless `phase === 'mash'`, `select-none touch-none`). `ready` phase: "GET READY..." pulsing. `result` phase: winner text ("YOU WIN THE BATTLE!" / "CPU WINS THE BATTLE!" / "IT'S A TIE!") — scores stay visible. Hint text: "TAP THE BUTTON OR SMASH SPACE". Score numbers use `font-display text-6xl` and `key={score}` + `.animate-pop-score` for pop effect.

### 5. `src/components/uno/battle-log.tsx`
```tsx
export function BattleLog({ entries }: { entries: LogEntry[] })
```
Root: `<footer className="mt-auto w-full border-t-4 border-black bg-[#0a0a0a]">`. Header row: "BATTLE LOG" label (font-display, yellow) + ScrollText icon. Scroll area `max-h-36 overflow-y-auto brutal-scroll`, newest entry at the bottom, auto-scroll to bottom on new entries (useRef + useEffect). Each entry: `▸ {text}` with slide-up animation (`.animate-slide-up`), colored per kind: info `#fffdf5`, play `#ffd600`, penalty `#ff6b61`, chaos `#ff9500`, battle `#ffffff` font-black, shield `#e5e7eb`, win `#4ade80`. Empty state: "No battles yet — press START GAME."

### 6. `src/components/uno/chaos-banner.tsx`
```tsx
export function ChaosBanner({ info }: { info: ChaosBannerInfo | null })
```
Fixed center-top overlay (`fixed left-1/2 top-24 z-[70] -translate-x-1/2`, `pointer-events-none`), only when info non-null. Black panel, 4px yellow border, yellow font-display text: small "CHAOS EVENT!" label + big `info.name` + `info.description`. Slight rotation (-2deg), `.animate-banner` slam-in, `shadow-[8px_8px_0_rgba(0,0,0,0.35)]`. Use `key={info.id}` on the panel for re-animation.

### Rules modal content (Task 2-a must include ALL of this):
1. **THE TWIST** — Every card is YELLOW. Forget colors — match the NUMBER on the discard pile, or slam an ACTION card at any time.
2. **NUMBER CARDS 0–9** — Play a number only if it matches the top card's number. If the top card is an action card, any number is legal.
3. **ACTION CARDS** (always playable) — with mini chips (small bordered squares + lucide icon):
   - SKIP (Ban icon): opponent loses their turn.
   - REVERSE (RefreshCcw icon): the turn bounces back — you go again.
   - +2: opponent draws 2 and is skipped.
   - MEGA +4: opponent draws 4 and is skipped. Devastating.
   - SWAP (ArrowLeftRight icon): instantly trade hands with the CPU. Brutal when you're losing.
   - WILDFIRE (Flame icon): EVERYONE draws 1 card.
   - SHIELD (Shield icon): raises a barrier that blocks the next time you're forced to draw (+2, +4, battle penalties, wildfire, chaos draws) — then it breaks.
   - BATTLE (Swords icon): triggers the SUDDEN CARD BATTLE mini-game.
4. **SUDDEN CARD BATTLE** — 3 seconds of button-mashing fury. Highest score wins; the loser draws 4 cards. Ties hurt everyone.
5. **CHAOS FRENZY METER** — every card played charges the meter. At 100% a random CHAOS EVENT erupts: DRAW RAIN (everyone draws 2), DECK EXPLOSION (reshuffle), or TOP CARD MORPH.
6. **WINNING** — first to empty their hand wins. Shout UNO when you hold one card.
7. **DIFFICULTY** — EASY: sleepy & sloppy. CHAOTIC: unpredictable action-card spam. INSANE: fast, tactical, merciless.

---

---
Task ID: 2-a
Agent: frontend-styling-expert
Task: Build UNO FRENZY modal & feedback components (rules-modal, stats-modal, game-over-modal, battle-modal, battle-log, chaos-banner)

Work Log:
- Read worklog.md design system + contracts, src/lib/uno/types.ts, and shadcn ui/dialog.tsx to confirm the exact Dialog API (showCloseButton prop, DialogClose export).
- Verified every required lucide icon exists in the installed lucide-react (Swords, Trophy, Skull, Ban, RefreshCcw, ArrowLeftRight, Flame, Shield, ScrollText, BookOpen, BarChart3, Play, X, Keyboard, MousePointerClick, RotateCcw, Trash2, Zap).
- Created src/components/uno/rules-modal.tsx — shadcn Dialog, brutal paper panel (5px black border, 8px hard shadow, yellow header bar, custom brutal X close). ALL 7 sections: THE TWIST (yellow highlight), NUMBER CARDS 0-9 (with 0-9 chip row), ACTION CARDS (grid of 8 color-coded mini chips: SKIP/REVERSE/+2 yellow #ffd600, MEGA +4/BATTLE red #ff3b30, SWAP/WILDFIRE orange #ff9500, SHIELD green #22c55e; +2/+4 use font-display text, others lucide icons), SUDDEN CARD BATTLE, CHAOS FRENZY METER (demo orange bar + 3 chaos event chips), WINNING (UNO chip), DIFFICULTY (EASY green / CHAOTIC orange / INSANE red chips).
- Created src/components/uno/stats-modal.tsx — 6-block stat grid (WINS green, LOSSES red, BATTLES WON orange, WIN RATE yellow-computed "—" when no games, CURRENT/BEST STREAK white), two-step reset (RESET STATS -> SURE? red + pulse -> onReset), confirm state disarms when modal closes; brutal BarChart3 header.
- Created src/components/uno/game-over-modal.tsx — giant Trophy/green vs Skull/red icon tile, YOU WIN! / YOU LOSE... title (colored, font-display), flavor description, difficulty chip via DIFFICULTY_LABELS, 5 career stat chips (WINS/LOSSES/STREAK/BEST/BATTLES WON), giant PLAY AGAIN button (hover lift, active press, focus ring). No cancel path: open is fully parent-controlled, ESC/overlay are harmless no-ops (no onOpenChange per contract).
- Created src/components/uno/battle-modal.tsx — hand-rolled fixed inset-0 z-[80] bg-black/70 overlay (role="dialog", aria-modal="true"), Swords header "SUDDEN CARD BATTLE!", YOU vs CPU (DIFFICULTY_LABELS) score panels with key={score} + .animate-pop-score text-6xl/7xl + VS chip, fixed min-height status area: ready = pulsing GET READY..., mash = giant Math.ceil(msLeft/1000) countdown + draining red bar (width = clamped msLeft/3000), result = winner text (green/red/orange) + draw-penalty subtitle, scores stay visible. MASSIVE yellow MASH! button: onPointerDown={onMash}, disabled unless phase === 'mash', select-none touch-none, context menu suppressed; hint "TAP THE BUTTON OR SMASH SPACE" with Keyboard icon. No onClick on the mash button so global SPACE handling cannot double-fire.
- Created src/components/uno/battle-log.tsx — root <footer mt-auto w-full border-t-4 border-black bg-[#0a0a0a]> (page must wrap in min-h-screen flex flex-col), BATTLE LOG header (ScrollText icon + yellow font-display label), scroll region max-h-36 brutal-scroll role="log" aria-live, auto-scroll to newest entry via useRef/useEffect on [entries], entries "▸ {text}" with .animate-slide-up, color map info #fffdf5 / play #ffd600 / penalty #ff6b61 / chaos #ff9500 / battle #ffffff font-black / shield #e5e7eb / win #4ade80, empty state "No battles yet — press START GAME."
- Created src/components/uno/chaos-banner.tsx — returns null when info is null; fixed left-1/2 top-24 z-[70] -translate-x-1/2 pointer-events-none wrapper; black panel with 4px #ffea00 border, -rotate-2, .animate-banner slam-in re-triggered via key={info.id}, orange "CHAOS EVENT!" label with Zap icon, big yellow name, paper description, exact shadow-[8px_8px_0_rgba(0,0,0,0.35)].
- Self-reviewed all 6 files line by line: strict TS (no any), no unused imports, no JSX unescaped entities, palette-only colors, 3-6px black borders, hard offset shadows only (no blur/gradients), no emojis, responsive mobile-first (max-w-[92vw] sm:max-w-lg, max-h-[70vh] brutal-scroll bodies), aria-labels on icon-only buttons. Did NOT run tsc/dev server per instructions (other agents' files mid-flight); did NOT touch any other files.

Stage Summary:
- Files created (exactly the 6 allowed): src/components/uno/rules-modal.tsx, src/components/uno/stats-modal.tsx, src/components/uno/game-over-modal.tsx, src/components/uno/battle-modal.tsx, src/components/uno/battle-log.tsx, src/components/uno/chaos-banner.tsx. Nothing else created or modified.
- Exported signatures (exact, all named exports, all 'use client'):
  - RulesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void })
  - StatsModal({ open, onOpenChange, stats, onReset }: { open: boolean; onOpenChange: (open: boolean) => void; stats: CareerStats; onReset: () => void })
  - GameOverModal({ open, winner, stats, difficulty, onPlayAgain }: { open: boolean; winner: 'player' | 'ai'; stats: CareerStats; difficulty: Difficulty; onPlayAgain: () => void })
  - BattleModal({ open, phase, msLeft, playerScore, aiScore, winner, difficulty, onMash }: { open: boolean; phase: BattlePhase; msLeft: number; playerScore: number; aiScore: number; winner: BattleWinner; difficulty: Difficulty; onMash: () => void })
  - BattleLog({ entries }: { entries: LogEntry[] })
  - ChaosBanner({ info }: { info: ChaosBannerInfo | null })
- Integration notes for main agent:
  1. Components depend on globals.css classes Task 3 must define: .font-display, .brutal-scroll, .animate-pop, .animate-pop-score, .animate-slide-up, .animate-banner (animate-pulse used for GET READY is a built-in Tailwind class).
  2. GameOverModal deliberately has NO onOpenChange prop (per contract): parent must set open=false when onPlayAgain is invoked; ESC/overlay clicks do nothing (harmless), so there is no cancel path that could break game state.
  3. BattleModal is NOT a Radix Dialog — it renders only when open=true and overlays at z-[80]; mash input arrives via onMash (pointerdown only). The global SPACE keydown in use-uno-game must call the same mash handler; the button intentionally has no onClick so keyboard SPACE cannot double-count.
  4. BattleModal clamps bar width and countdown seconds to >= 0, so a slightly negative msLeft is safe.
  5. StatsModal reset: first click arms "SURE?", second click fires onReset; arming auto-resets when the modal closes.
  6. BattleLog is the page footer (mt-auto) — page shell must be min-h-screen flex flex-col; its inner content is centered at max-w-4xl.
  7. ChaosBanner expects info objects with a unique id (number) to re-trigger the slam animation between consecutive chaos events.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Inspect project, create shared type contracts and worklog plan

Work Log:
- Inspected project: Next.js 16, React 19, Tailwind 4, full shadcn/ui set (dialog available), lucide-react installed, dev server already running on :3000
- Created src/lib/uno/types.ts with ALL shared types (UnoCard, Difficulty, LogEntry, CareerStats, ChaosEventKind, ChaosBannerInfo, BattleState, GamePhase, SoundName, DIFFICULTY_LABELS)
- Created this worklog with master plan, game rules summary, design system and Task 2-a component contracts

Stage Summary:
- Single source of truth for types established before any parallel work began

---
Task ID: 2-b
Agent: main (Z.ai Code)
Task: Build game engine, sound engine and stats persistence modules (in parallel with Task 2-a)

Work Log:
- src/lib/uno/engine.ts — 57-card all-yellow deck (numbers 0-9 ×3 + SKIP×4/REVERSE×4/+2×4/MEGA+4×3/SWAP×3/WILDFIRE×3/SHIELD×3/BATTLE×3), Fisher-Yates shuffle, Frenzy matching rule (action cards always playable; numbers match top number; any number after an action card), createInitialGame dealing 7/7 + forcing a number top card, AI brain (chooseAiCard per difficulty: easy=random, chaotic=action-aggression, insane=tactical attack/dump heuristics), aiShouldPlayDrawn chances (0.5/0.75/1.0), aiTurnDelayMs (1400-2000/900-1500/480-900ms), AI battle mash rates (3.2/6.0/9.2 per sec), chaos event meta + picker
- src/lib/uno/sound.ts — Web Audio synthesized arcade SFX singleton (19 sounds: card/draw/penalty/shield/swap/wildfire/battle-fanfare/mash/chaos-siren/win/lose/uno-jingle/countdown/go...), lazy AudioContext after user gesture, mute flag, master gain 0.28
- src/lib/uno/stats.ts — localStorage career stats (uno-frenzy-stats-v1) + sound preference (uno-frenzy-sound-v1) with safe parsing/SSR guards

Stage Summary:
- Engine is pure (randomness stays outside the reducer), AI personalities tuned, zero external audio assets needed

---
Task ID: 3
Agent: main (Z.ai Code)
Task: Build game state hook, core UI components, page assembly and arcade styles

Work Log:
- src/hooks/use-uno-game.ts — the full game state machine: reducer (NEW_GAME/PLAYER_DRAW/PLAYER_PLAY/KEEP_DRAWN/AI_PLAY/AI_DRAW/AI_PASS/APPLY_CHAOS/BATTLE_GO/BATTLE_TICK/BATTLE_MASH/BATTLE_CLOSE/TOGGLE_SOUND/RESET_STATS/BOOT) + effects: sound-from-log player, chaos resolver (draw-rain/reshuffle/top-morph with banner+shake), banner auto-dismiss, DOM screen-shake via getElementById, AI turn scheduler with banner/pending-drawn guards, AI drawn-card follow-up, player pending-draw auto-pass, battle lifecycle manager (ready 900ms → 3s mash at 100ms ticks → result 1.7s → close & pass turn), countdown beeps, SPACE-key mash listener, stats/sound persistence. Card effects: skip/reverse bounce turn, +2/+4 penalize & skip opponent, swap exchanges hands, wildfire draws 1 for both, shield blocks next forced draw (penalties/battle/wildfire/chaos), battle triggers mini-game (loser +4, tie both +2). Win check before effects; UNO shout at 1 card; frenzy +8/card with chaos at 100%
- src/components/uno/game-card.tsx — all-yellow brutalist card (3px border, hard shadow, hover lift/rotate on playable, dim on unplayable, ring highlight for drawn card, striped U! card back, number corner pip, action glyphs via lucide)
- src/components/uno/chaos-meter.tsx — frenzy meter (yellow→orange→red fill, pulse + "CHAOS IMMINENT!" at ≥80%)
- src/components/uno/game-board.tsx — AI hand area (chips: CPU/difficulty/count/shield/UNO/thinking), table (status line, clickable stacked draw pile with count badge, ghost-stacked discard with pop animation, chaos meter), player hand area (chips, pending-draw PLAY IT/KEEP prompt, deal-staggered cards), idle START panel
- src/app/page.tsx — shell: black header (logo, Rules/Stats/Sound/Restart), difficulty toolbar (EASY white/CHAOTIC orange/INSANE red, active pressed-in, click restarts), main board, BattleLog footer, overlays (ChaosBanner, BattleModal, RulesModal, StatsModal, GameOverModal)
- src/app/globals.css — appended arcade layer: .font-display (Impact/Arial Black), .bg-arcade diagonal stripes, .brutal-scroll, screen-shake/pop-in/banner-slam/deal-in/meter-pulse/slide-up/pop-score keyframes
- src/app/layout.tsx — metadata retitled "UNO FRENZY — Chaotic Arcade Card Game"

Stage Summary:
- Integrated subagent's 6 components (2-a) against their exact contracts — zero integration friction
- Reducer stays pure; all randomness lives in hook effects/handlers

---
Task ID: 4
Agent: main (Z.ai Code)
Task: Lint, dev-server log check and fixes

Work Log:
- Fixed stats-modal setState-in-effect lint error (replaced with intercepted onOpenChange close handler that disarms the two-step reset confirm)
- Removed unused eslint-disable directive
- Reworked screen-shake from setState-in-effect → DOM classList manipulation (react-hooks/set-state-in-effect rule), then from a ref-in-API (react-hooks/refs rule flagged every game.* access) → getElementById('uno-frenzy-shell') inside the effect
- Removed unused drawCard param + dead code; fixed React.ReactNode import in page
- bun run lint → 0 errors, 0 warnings; dev.log clean (transient Fast Refresh warnings only from mid-edit states)

Stage Summary:
- Lint fully green under the new react-hooks v6 rules (set-state-in-effect, refs)

---
Task ID: 5
Agent: main (Z.ai Code)
Task: Agent-browser E2E verification of the full game

Work Log:
- Idle screen renders (header, difficulty toolbar, START panel, sticky footer); screenshot verified
- START GAME: 7/7 dealt, 42-card deck (57-14-1), numbers correctly disabled when not matching top, action cards always enabled
- MEGA +4: CPU drew 4 + skipped, attacker went again ✓
- WILDFIRE: both drew 1, turn passed ✓
- CPU (chaotic) plays strategically, raised SHIELD ✓; insane CPU reacts fast ✓
- SHIELD absorption verified both directions (CPU shield ate my +2; my shield ate DRAW RAIN chaos draws) ✓
- SWAP exchanged hands, CPU then played from my old hand ✓
- SKIP/REVERSE bounce the turn ✓; UNO shouts logged ✓
- CHAOS FRENZY: +8/card verified, 100% trigger fired DRAW RAIN with log + shield interactions; meter reset ✓
- BATTLE mini-game: played via click and via 60 rapid SPACE keydowns — won 60—22 (chaotic ≈7.3 taps/s consistent), CPU won an unmashed one 21—12/17—0, loser drew 4 both ways ✓
- Modals: Rules ("HOW TO PLAY") and Stats ("CAREER STATS") open/close via ESC ✓
- Game over reached (CPU won at UNO): GameOverModal with stat chips, localStorage persisted {losses:1, battlesWon:1, streak reset}, PLAY AGAIN dealt fresh game ✓
- Difficulty switch mid-game instantly restarts at new difficulty ✓; sound toggle persists ("0"/"1") ✓
- Footer: sticks to bottom on short idle screen (bottom=viewport=844, scrollHeight 844), pushed down naturally on long mobile content ✓
- Mobile 390px + desktop 1280px screenshots VLM-reviewed: neo-brutalist aesthetic coherent, no overlap/cutoff/overflow, battle modal layout confirmed
- Zero page errors, zero console errors; dev.log all 200s

Stage Summary:
- Golden path fully verified end-to-end: play → penalties → chaos → battle → game over → stats → replay. Browser-verified interactivity achieved.

---
Task ID: 6
Agent: main (Z.ai Code)
Task: Finalize worklog and deliver report

Work Log:
- Appended all worklog sections; final dev server check passed; browser closed after verification

Stage Summary:
- UNO FRENZY is complete and playable at `/` via the Preview Panel

# ═════════════════════════════════════════════════════════════════
# PHASE 2 — ONLINE PVP MATCHES (player vs player over socket.io)
# ═════════════════════════════════════════════════════════════════

## Master Plan (Phase 2)

| Task ID | Owner | Scope |
|---|---|---|
| 1 | main | Install socket.io-client, scaffold mini-service, create `src/lib/uno/pvp-protocol.ts` (shared client/server contract) + this worklog update |
| 2-a | subagent (general-purpose) | `mini-services/uno-pvp/index.ts` — authoritative socket.io PvP room server (port 3005) |
| 2-b | subagent (frontend-styling-expert) | PvP UI: `pvp-lobby.tsx`, `pvp-game-board.tsx`, `pvp-battle-modal.tsx`, `pvp-game-over-modal.tsx` |
| 3 | main | `src/hooks/use-uno-pvp.ts`, pvp stats (`stats.ts` + types), `stats-modal.tsx` pvp row, `battle-log.tsx` emptyHint prop, `page.tsx` mode switcher (VS CPU / VS PLAYER) |
| 4 | main | lint + fixes + start mini-service + dev.log check |
| 5 | main | agent-browser 2-tab E2E of a full PvP match + fixes |
| 6 | main | Final worklog + report |

## PvP Feature Summary

- New mode toggle on `/`: **VS CPU** (existing game, unchanged) vs **VS PLAYER** (online 1v1).
- VS PLAYER: enter a name → CREATE MATCH (get a 4-char room code) or JOIN MATCH (type the code). Lobby waits for the challenger, then a match starts automatically with a random player going first.
- FULL UNO FRENZY rules in PvP, run authoritatively on the server: number matching, all 8 action cards, SHIELD absorption, SWAP, WILDFIRE, +2/+4 penalties, chaos frenzy meter (+8/card, 100% → DRAW RAIN / DECK EXPLOSION / TOP CARD MORPH with banner + screen shake), win by emptying your hand.
- SUDDEN CARD BATTLE in PvP: BOTH humans mash for 3s; higher score wins, loser draws 4, tie both draw 2.
- Draw flow: drawing player sees the drawn card; if playable they choose PLAY IT / KEEP, otherwise it auto-passes after ~1.3s.
- Disconnect or leaving mid-match = forfeit (opponent wins). Rematch button restarts instantly for both (only when both connected).
- PvP career (wins/losses) persisted in localStorage key `uno-frenzy-pvp-stats-v1`, shown in the stats modal as a PVP RECORD row (separate from CPU career stats).
- Server: `mini-services/uno-pvp/` (bun + socket.io, port 3005, `bun --hot`). Client socket: `io('/?XTransformPort=3005', { transports: ['websocket','polling'] })` — same pattern as `examples/websocket/`.
- The server imports shared logic from `../../src/lib/uno/pvp-protocol.ts` + `engine.ts` + `types.ts` (pure TS, bun resolves them natively).

## PvP GAME-RULES SPEC FOR THE SERVER (Task 2-a) — mirrors the CPU reducer exactly

State per room: `gameId, deck, discard, hands[2], turn, frenzy, chaosPending, shields[2], pendingDrawn[2], phase ('waiting'|'playing'|'battle'|'game-over'), battle {phase:'ready'|'mash'|'result', msLeft, scores[2], winner, initiator}, gameOver {winner, reason}, log (cap 80, LogEntry with server-assigned numeric ids), logSeq, bannerSeq, shakeSeq, chaosBanner`.

- NEW MATCH: `createInitialGame()` from engine → playerHand→seat0, aiHand→seat1, first discard = a number card. Random seat goes first. Log `"{nameA} VS {nameB} — {name} GOES FIRST!"`. gameId += 1.
- PLAY validation: phase 'playing', turn === seat, card in that seat's hand, if `pendingDrawn[seat]` set then ONLY that card may be played, `isPlayable(card, top)` from engine.
- playCard effects (all mirror `use-uno-game.ts` reducer): log `"{name} plays {cardName}!"` + sound from PVP_CARD_SOUNDS; frenzy += 8 (>=100 → subtract 100, chaosPending = true); UNO shout log at 1 card left; WIN check BEFORE effects → phase 'game-over', winner, reason 'empty-hand', log + sound win/lose; number → pass turn to opponent; skip/reverse → same player goes again (log); draw2/draw4 → applyPenalty(opponent) then same player goes again; swap → swap hands, pass turn; wildfire → both draw 1 (shield applies), pass turn; shield → set that seat's shield, pass turn; battle → phase 'battle', battle {phase:'ready', msLeft:3000, scores:[0,0], winner:null, initiator:seat}.
- applyPenalty(seat, count): if shields[seat] → consume shield, log "SHIELD absorbs the attack — no cards drawn!" (kind 'shield', sound 'shield'), return; else draw up to count cards into hand (drawCard reshuffles discard into deck when deck runs empty; if truly no cards → log "every card is in play!"); log `"{name} draws N cards!"` kind 'penalty' sound 'penalty'.
- DRAW validation: phase 'playing', turn === seat, no pendingDrawn[seat]. Card = drawCard(); if none → log "no cards left to draw — turn passes", pass turn. Else push to hand, pendingDrawn[seat] = card, log `"{name} draws a card."` sound 'draw'. If NOT playable → schedule auto-keep after 1300ms (guard: pendingDrawn[seat] still that card id). If playable the player chooses.
- KEEP: clear pendingDrawn, log `"{name} keeps the drawn card."` (or on auto-pass: "No match — turn passes."), pass turn to opponent.
- CHAOS: resolve only when `phase === 'playing'` (defer while battle/game-over — check after every mutation + when battle closes). pickChaosEvent() from engine; banner (bannerSeq++, chaosBanner set, shakeSeq++), log kind 'chaos' sound 'chaos'. draw-rain → both seats applyPenalty(2); reshuffle → deck = shuffle(deck + discard minus top), discard = [top], log; morph → random card from deck (fallback makeRandomNumberCard), remove from deck, old top pushed into deck, new top = morph, log "The top card morphs into X!".
- BATTLE lifecycle (server timers, guard every callback): ready 900ms → mash; mash interval 100ms → msLeft -= 100 (clamp 0), broadcast; at 0 → winner = higher score ('tie' equal), phase 'result', log + applyPenalty (loser 4 / both 2), stats-ish log lines like the CPU game ("{name} WINS THE BATTLE a—b!"); result 1700ms → battle = null, phase 'playing', turn = opponent of initiator, then tryResolveChaos.
- MASH: phase 'battle' && battle.phase === 'mash' → scores[seat] += 1.
- REMATCH: phase 'game-over' && both seats connected → newMatch() (logs "REMATCH!").
- LEAVE / DISCONNECT: if phase 'waiting' → destroy room. Else: clear timers, gameOver {winner: other seat, reason 'forfeit'}, phase 'game-over', log, sockets[seat] = null, broadcast to remaining. When last socket leaves → destroy room.
- Broadcast: after every state change, emit `room:state` (PvpRoomView) to EACH connected socket, personalized: hand = hands[seat], opponentCardCount = other hand length, pendingDrawn = that seat's own pending card, opponentDeciding = other seat's pendingDrawn !== null, opponentConnected = other socket present.
- Room codes: 4 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I L O 0 1). Names: trim, collapse spaces, max 12 chars, default "PLAYER 1" / "PLAYER 2". Ack errors: 'not-found', 'full', 'invalid-name', 'invalid-code'.

## PvP UI CONTRACTS — Task 2-b (subagent frontend-styling-expert)

Shared: `import { PvpRoomView, Seat } from '@/lib/uno/pvp-protocol'`, `import { BattlePhase } from '@/lib/uno/types'`. Reuse existing `GameCard` (`@/components/uno/game-card`), `ChaosMeter` (`@/components/uno/chaos-meter`), `cardName` from engine. Follow the DESIGN SYSTEM above EXACTLY (neo-brutalist, no blue/indigo).

### 1. `src/components/uno/pvp-lobby.tsx`
```tsx
export function PvpLobby({ connected, busy, error, roomCode, onCreate, onJoin, onCancel }: {
  connected: boolean
  busy: boolean
  error: string | null
  roomCode: string | null   // non-null → "waiting for challenger" state
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
  onCancel: () => void
})
```
- `!connected`: panel "CONNECTING TO THE ARENA…" (pulsing). `connected && !roomCode`: name Input (max 12), room-code Input (auto-uppercase, 4 chars, alphanumeric only), CREATE MATCH button (yellow, Users icon) and JOIN MATCH button (white, requires 4-char code) — both disabled while busy. Footnote: "2 players · 2 devices or tabs · leaving a live match counts as a FORFEIT". Error chip (red `#ff3b30`) under the form when `error`. `roomCode`: giant 4-char code display (font-display, tracking-widest, paper panel), "WAITING FOR A CHALLENGER…" pulsing, SHARE THE CODE note, click-to-copy button (clipboard + "COPIED!" feedback 1.5s, falls back to selecting text), red CANCEL button.

### 2. `src/components/uno/pvp-game-board.tsx`
```tsx
export function PvpGameBoard({ view, onPlay, onDraw, onKeep, isCardPlayable }: {
  view: PvpRoomView
  onPlay: (cardId: string) => void
  onDraw: () => void
  onKeep: () => void
  isCardPlayable: (card: UnoCard) => boolean
})
```
Mirror `game-board.tsx` structure exactly (3 sections: opponent → table → your hand): opponent area = name chip (User icon, name), count chip, shield chip, UNO! chip at 1, "DECIDING…" pulsing when `view.opponentDeciding`, "THEIR TURN" red pulsing chip when playing & turn !== you; opponent cards face-down `view.opponentCardCount` × GameCard size sm (animate-deal stagger, keyed `${view.gameId}-${i}`). Table panel (paper, 5px border): status line (YOUR TURN black chip when playing & yours / "{NAME} IS PLAYING…" red pulsing / "CARD BATTLE IN PROGRESS" orange / GAME OVER chip), draw pile (stacked backs + deck count badge, clickable only when playing & your turn & !pendingDrawn), discard (same ghost-stack + animate-pop top as game-board), ChaosMeter. Your hand area: "YOU · {myName}" chip, count, shield, UNO!, green "▶ YOUR TURN" chip; pending drawn prompt (yellow panel, "Drew: {cardName}", PLAY IT / KEEP buttons when playable else "No match — turn passes…"); hand cards GameCard size md interactive playable via isCardPlayable, highlight = pendingDrawn id match, animate-deal keyed by gameId, onClick onPlay(card.id). Use `names[you]` etc. via `view.you`.

### 3. `src/components/uno/pvp-battle-modal.tsx`
```tsx
export function PvpBattleModal({ open, phase, msLeft, myScore, oppScore, myName, oppName, winner, onMash }: {
  open: boolean
  phase: BattlePhase
  msLeft: number
  myScore: number
  oppScore: number
  myName: string
  oppName: string
  winner: 'you' | 'opp' | 'tie' | null   // hook maps seat → 'you'/'opp'
  onMash: () => void
})
```
Same hand-rolled overlay as `battle-modal.tsx` (fixed inset-0 z-[80] bg-black/70, role="dialog" aria-modal): header "SUDDEN CARD BATTLE!" (Swords), score panels `YOU ({myName})` vs `({oppName})` with key={score} .animate-pop-score text-6xl/7xl + VS chip, draining red time bar + giant countdown, MASSIVE yellow MASH! button (onPointerDown={onMash}, disabled unless phase==='mash', select-none touch-none), hint "TAP THE BUTTON OR SMASH SPACE". result: "YOU WIN THE BATTLE!" green / "{oppName} WINS THE BATTLE!" red / "IT'S A TIE!" orange + penalty subtitle. Do NOT use onClick on the mash button.

### 4. `src/components/uno/pvp-game-over-modal.tsx`
```tsx
export function PvpGameOverModal({ open, view, onRematch, onLeave }: {
  open: boolean
  view: PvpRoomView
  onRematch: () => void
  onLeave: () => void
})
```
Hand-rolled full-screen overlay (fixed inset-0 z-[75] bg-black/70, p-4), only when open. Giant icon tile: Trophy green "YOU WIN!" vs Skull red "YOU LOSE…". Result subtitle by `view.gameOver.reason`: 'empty-hand' → "You emptied your hand first — FRENZY MASTER!" / "{oppName} emptied their hand first."; 'forfeit' → "{oppName} left the match — VICTORY BY FORFEIT!". Chips: ROOM {roomCode} + opponent name. Buttons: REMATCH (yellow, RotateCcw icon, only when `view.opponentConnected && view.gameOver.reason === 'empty-hand'`) and LEAVE MATCH (white/ red, LogOut icon). Both always visible height-wise (leave disabled? no — leave always active).

---
Task ID: 2-b
Agent: frontend-styling-expert
Task: Build PvP UI components (pvp-lobby, pvp-game-board, pvp-battle-modal, pvp-game-over-modal)

Work Log:
- Read the full worklog (design system + "PvP UI CONTRACTS — Task 2-b"), pvp-protocol.ts (PvpRoomView), types.ts, engine.ts (cardName/isPlayable), game-board.tsx, game-card.tsx, battle-modal.tsx, game-over-modal.tsx, chaos-meter.tsx, ui/input.tsx and globals.css — mirrored the CPU board structure and reused GameCard/ChaosMeter instead of duplicating anything.
- Verified every lucide icon used exists in the installed lucide-react (Users, User, Hand, Shield, Loader2, Copy, Check, X, AlertTriangle, Swords, Keyboard, MousePointerClick, Trophy, Skull, RotateCcw, LogOut).
- Created src/components/uno/pvp-lobby.tsx — three prop-driven states: (1) !connected → paper panel, spinning Loader2 + pulsing "CONNECTING TO THE ARENA…"; (2) form → brutal shadcn Input overrides (4px black border, hard shadow, black/40 placeholder, black focus ring; name maxLength 12; room-code input auto-uppercase + non-alphanumeric filter + 4-char cap + tracking-widest centered + Enter submits join), CREATE MATCH yellow always-on unless busy (blank name falls back to "PLAYER 1" so the server never receives an empty name), JOIN MATCH white enabled only when trimmed name + 4-char code, busy → both buttons show "…" and disable, forfeit footnote, red AlertTriangle error chip (role="alert", animate-pop); (3) waiting → ROOM CODE label + giant font-display text-5xl/7xl tracking-[0.3em] code on a white tile (pl-[0.3em] optical centering), pulsing orange WAITING FOR A CHALLENGER… chip, share helper text, COPY CODE (navigator.clipboard → sr-only hidden-input focus/select + execCommand fallback, green "COPIED!" for 1.5s with deduped timer) + red CANCEL.
- Created src/components/uno/pvp-game-board.tsx — copied game-board's Chip helper + DECK_BACK and mirrored the 3 sections exactly: opponent (black User chip + name, count chip, shield chip, UNO! at 1, red pulsing THEIR TURN, orange pulsing DECIDING…, face-down sm cards with 35ms deal stagger keyed `${gameId}-opp-${i}`); table (StatusLine: black "▶ YOUR TURN" + hint / red pulsing "{opp} IS PLAYING…" / orange "⚔ CARD BATTLE IN PROGRESS" / black "GAME OVER"; identical stacked draw pile with deckCount badge, disabled unless myTurn && !pendingDrawn, aria-label with deck count; identical ghost-stack discard with animate-pop top keyed topCard.id; ChaosMeter); your hand ("YOU · {name}" Hand chip, count, shield, UNO!, green "▶ YOUR TURN", identical yellow pending prompt with PLAY IT/KEEP or "No match — turn passes…", interactive md cards playable via isCardPlayable with pendingDrawn ring highlight, 35ms deal stagger keyed `${gameId}-${card.id}`, hint line when myTurn && !pendingDrawn).
- Created src/components/uno/pvp-battle-modal.tsx — copied battle-modal's overlay/panel/animations with PvP labels: hand-rolled fixed inset-0 z-[80] bg-black/70 (role="dialog" aria-modal), Swords header "SUDDEN CARD BATTLE!", YOU + small ({myName}) green chip vs red ({oppName}) chip with truncate guard, key={score} .animate-pop-score text-6xl/7xl, black VS chip, fixed min-height status area (pulsing GET READY… / giant Math.ceil(msLeft/1000) countdown + red draining bar clamped 0-100% / colored result: YOU WIN THE BATTLE! #22c55e, {oppName} WINS THE BATTLE! #ff3b30, IT'S A TIE! #ff9500 + "Loser draws 4!" / "Both players draw 2!"), MASSIVE yellow MASH! button onPointerDown ONLY (no onClick), disabled unless mash, select-none touch-none, context menu suppressed, Keyboard hint "TAP THE BUTTON OR SMASH SPACE".
- Created src/components/uno/pvp-game-over-modal.tsx — hand-rolled z-[75] overlay (role="dialog" aria-modal), paper panel with the exact spec classes plus max-h-[88vh] overflow-y-auto brutal-scroll safety for short screens, Trophy/green vs Skull/red size-20 icon tile, "YOU WIN!"/"YOU LOSE…" font-display title, reason-based subtitles (empty-hand: "You emptied your hand first — FRENZY MASTER!" / "{oppName} emptied their hand first."; forfeit: "{oppName} left the match — VICTORY BY FORFEIT!" / "You left the match."), black ROOM chip + white opponent chip, stacked full-width REMATCH (yellow, RotateCcw, only when opponentConnected && reason 'empty-hand') + LEAVE MATCH (white bg with red text accent, LogOut, always present).
- Self-reviewed all 4 files: strict TS (no any), no unused imports, palette-only colors, hard offset shadows only (no blur/gradients), 52px+ touch targets on primary buttons, aria-labels/roles on dialogs and icon controls, no emojis (▶/⚔/…/·/— chars match game-board conventions). Did NOT run lint/build/dev server per instructions; did NOT touch any other file.

Stage Summary:
- Files created (exactly the 4 allowed): src/components/uno/pvp-lobby.tsx, src/components/uno/pvp-game-board.tsx, src/components/uno/pvp-battle-modal.tsx, src/components/uno/pvp-game-over-modal.tsx. Nothing else created or modified.
- Exported signatures (exact, named exports, all 'use client'):
  - PvpLobby({ connected, busy, error, roomCode, onCreate, onJoin, onCancel }: { connected: boolean; busy: boolean; error: string | null; roomCode: string | null; onCreate: (name: string) => void; onJoin: (name: string, code: string) => void; onCancel: () => void })
  - PvpGameBoard({ view, onPlay, onDraw, onKeep, isCardPlayable }: { view: PvpRoomView; onPlay: (cardId: string) => void; onDraw: () => void; onKeep: () => void; isCardPlayable: (card: UnoCard) => boolean })
  - PvpBattleModal({ open, phase, msLeft, myScore, oppScore, myName, oppName, winner, onMash }: { open: boolean; phase: BattlePhase; msLeft: number; myScore: number; oppScore: number; myName: string; oppName: string; winner: 'you' | 'opp' | 'tie' | null; onMash: () => void })
  - PvpGameOverModal({ open, view, onRematch, onLeave }: { open: boolean; view: PvpRoomView; onRematch: () => void; onLeave: () => void })
- Integration notes for Phase-2 Task 3:
  1. PvpLobby is fully prop-driven (connected/busy/error/roomCode) — the hook owns every socket emit; onCreate never sends an empty name (falls back to "PLAYER 1"); onJoin only fires with a trimmed name + 4-char code (Enter in the code field included).
  2. PvpGameBoard expects isCardPlayable(card) to already fold in turn + pendingDrawn legality (PvP mirror of isCardPlayableNow); hand keys are `${gameId}-${card.id}` and opponent keys `${gameId}-opp-${i}` so deal animations replay on every new match/rematch. view.topCard may be briefly null — handled.
  3. PvpBattleModal expects the hook to map seat-based battle data to myScore/oppScore/winner ('you'|'opp'|'tie'); the global SPACE keydown must call the same onMash — the button intentionally has NO onClick so keyboard cannot double-count; msLeft, bar width and countdown are clamped internally so negative ticks are safe.
  4. PvpGameOverModal reads everything from PvpRoomView; REMATCH renders only when view.opponentConnected && view.gameOver?.reason === 'empty-hand' (hook should still guard the emit server-side); LEAVE MATCH is always active (forfeit path lives in the hook/server).
  5. z-order: PvpBattleModal z-[80] > PvpGameOverModal z-[75]; both return null when closed — render each only when its phase demands it.



---
Task ID: 2-a
Agent: general-purpose
Task: Implement mini-services/uno-pvp socket.io PvP game server

Work Log:
- Read the full worklog (Phase 2 PvP spec), pvp-protocol.ts, types.ts, engine.ts, use-uno-game.ts reducer and examples/websocket/server.ts pattern.
- Created mini-services/uno-pvp/index.ts (~700 lines, strict TS, no `any`): socket.io Server on PVP_SERVICE_PORT=3005 with the exact example config (path '/', CORS '*', pingTimeout 60000, pingInterval 25000) + graceful SIGTERM/SIGINT shutdown. Shared code imported via relative paths (engine, pvp-protocol, types) — nothing copy-pasted.
- Typed the socket layer with socket.io event maps keyed by the PVP_EVENT constants (ClientToServerEvents / ServerToClientEvents / SocketData { roomCode, seat }), so every socket.on/emit is compile-checked against the protocol; runtime payloads are defensively re-validated (ack wrapped so a missing callback can't crash).
- Room registry: Map<string, Room>, 4-char codes from ABCDEFGHJKMNPQRSTUVWXYZ23456789 (regenerate on collision). Full authoritative room state: gameId, deck, discard, hands[2], turn, frenzy, chaosPending, shields[2], pendingDrawn[2], phase, battle, gameOver, log (cap 80, server logSeq ids), bannerSeq, shakeSeq, chaosBanner, per-seat autoKeep timers, battle timers owned by the battle object.
- game logic mirrors the CPU reducer exactly with player names: applyPlay (play log + PVP_CARD_SOUNDS, frenzy +8 → chaosPending at 100, UNO shout at 1, WIN before effects → game-over/empty-hand, number/skip/reverse/draw2/draw4/swap/wildfire/shield/battle effects, same-player-goes-again semantics), applyPenalty (shield absorb first, drawCard reshuffles discard-minus-top with the "Deck empty — blasts back" log, "draws N cards!" / "every card is in play!"), draw flow (pendingDrawn + PLAY IT/KEEP, unplayable → server auto-keep after 1300ms guarded by pendingDrawn id), keep (manual "{name} keeps the drawn card." / auto "No match — turn passes.").
- Battle lifecycle on server timers: ready 900ms → mash, 100ms tick interval decrements msLeft (3000→0) with broadcast per tick, at 0 → result + winner determination (higher score / tie) + penalties via applyPenalty (loser 4, tie both 2, shield absorbs), "{name} WINS THE BATTLE a—b!" / "BATTLE TIE a—b!" logs, 1700ms later battle closes → turn = opponent of initiator → tryResolveChaos. Every timer callback is guarded by battle-object identity + phase; timers live on the battle object itself so stale callbacks can never touch a new battle.
- Chaos (tryResolveChaos — only fires while phase === 'playing', deferred during battle/game-over, re-checked after every mutation and on battle close): pickChaosEvent, bannerSeq/shakeSeq/chaosBanner + "CHAOS EVENT:" log, draw-rain (both applyPenalty 2), deck explosion (shuffle deck+discard-minus-top, "Deck rebuilt — N cards ready."), morph (random deck card spliced, fallback makeRandomNumberCard, old top into deck, "The top card morphs into X!").
- Leave/disconnect: waiting → destroy room; mid-match (playing/battle) → clear timers + pendingDrawn, forfeit game-over {winner: other, reason: 'forfeit'}, "LEFT THE MATCH — FORFEIT!" log, broadcast to survivor; after game-over → only presence update (result never rewritten); last socket out → destroy.
- Broadcast: personalized PvpRoomView per connected socket (own hand, opponentCardCount, own pendingDrawn vs opponentDeciding, opponentConnected, shared log/chaosBanner/shakeSeq/gameId/turn/frenzy/shields/battle/gameOver/deckCount/topCard/names/roomCode/you/phase). chaosBanner intentionally persists in views until the next chaos event replaces it — client handles dismissal.
- VERIFIED: `bunx tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler index.ts` → 0 errors. Boot check `bun run dev` → "UNO FRENZY PvP server running on port 3005" with no errors. Live socket.io smoke tests (ephemeral bun -e scripts, no files added): room create/join/full/invalid-name/invalid-code/not-found acks, name collapse ("  BOB   TWO " → "BOB TWO"), 7/7 deal + 42 deck + number top, VS/GOES FIRST opening log, autoplayed a FULL match to empty-hand victory (chaos fired, shield/swap/skip all logged), battle run (ready→mash ticks drain msLeft, scores counted, winner + penalty, close → turn = opponent of initiator), draw run (pendingDrawn restriction rejects other-card play, draw ignored while pending, manual keep + auto-keep "No match — turn passes."), rematch (gameId 2 + "REMATCH!" log), forfeit on disconnect (survivor sees reason 'forfeit', opponentConnected false), rooms destroyed in server log. Server killed + port 3005 freed afterwards.

Stage Summary:
- Files created: mini-services/uno-pvp/index.ts only (service.log is a boot artifact). Nothing else touched.
- Key decisions for Task 3 (frontend hook):
  1. Connect with `io('/?XTransformPort=3005', { path: '/', transports: [...] })` — path MUST be '/' (not socket.io default).
  2. Every ack is a PvpAck ({ok, error? 'invalid-name'|'invalid-code'|'not-found'|'full'|'error', roomCode? on create}).
  3. room:state arrives BEFORE the join/create ack resolves — treat the ack purely as confirmation, drive all state from room:state.
  4. Server auto-keeps an unplayable drawn card after 1300ms ("No match — turn passes.") — the client prompt only needs its own fallback timer for the playable case.
  5. chaosBanner STAYS in PvpRoomView until the next chaos event; the client must dismiss it locally (e.g. BANNER_MS) and re-show when the banner id changes. shakeSeq increments per chaos event for the DOM shake.
  6. Win log entry carries sound 'win' — the hook may want to play 'lose' locally for the losing seat instead of the attached sound. Battle result logs carry 'battle'/'penalty' sounds; sounds otherwise mirror the CPU game log lines.
  7. log ids are monotonic per room (never reset across rematches) — track lastPlayedLogId to fire sounds once; log array resets to [REMATCH!, VS line] each match.
  8. Rematch is server-validated (phase game-over + both connected) and auto-broadcasts a fresh deal (gameId increments).
  9. Deviation from spec (deliberate): disconnect AFTER a match already ended only updates opponentConnected — it never rewrites gameOver/reason (avoids "VICTORY BY FORFEIT" flashing over a real empty-hand win). Mid-match disconnects behave exactly per spec.
  10. Start with `cd mini-services/uno-pvp && bun run dev` (port 3005).

---
Task ID: 1 (Phase 2)
Agent: main (Z.ai Code)
Task: PvP scaffolding + shared protocol

Work Log:
- Installed socket.io-client in the main project; created mini-services/uno-pvp with package.json (bun --hot, socket.io ^4.8.4)
- Created src/lib/uno/pvp-protocol.ts — single source of truth: PVP_EVENT names, PvpAck/PvpAckError, PvpRoomView (personalized snapshot), PvpBattleView, PvpGameOverView, PVP_CARD_SOUNDS; pure TS, importable by both the Next app and the bun mini-service
- Wrote Phase 2 master plan + server spec + 2-b UI contracts into this worklog; launched subagents 2-a (backend) and 2-b (frontend) in parallel

Stage Summary:
- Protocol-first design; engine + types shared by client and server with zero duplication

---
Task ID: 3 (Phase 2)
Agent: main (Z.ai Code)
Task: Frontend integration — pvp hook, stats, page mode switcher

Work Log:
- src/hooks/use-uno-pvp.ts — thin server-driven client: lazy socket via io('/?XTransformPort=3005', { path: '/' }), all state from room:state snapshots; log-sound player (win entry swapped to 'lose' for the losing seat), chaos banner show/dismiss (BANNER_MS), DOM screen-shake on shakeSeq, battle go/countdown sounds via prev-view diff, PvP record counted once per room:gameId (statsRef to avoid stale closures), SPACE-key mash, per-room tracker reset on roomCode change, connect_error + disconnect recovery messaging
- src/lib/uno/stats.ts — added PvpStats {wins,losses} + DEFAULT_PVP_STATS + load/save (key uno-frenzy-pvp-stats-v1, separate from CPU career stats)
- stats-modal.tsx — new required pvpStats prop + PVP RECORD section (PVP WINS yellow / PVP LOSSES orange / win-rate chip); RESET STATS now wipes both records via combined callback
- battle-log.tsx — optional emptyHint prop (PvP: 'No matches yet — create or join a room.')
- page.tsx — MODE toolbar (VS CPU / VS PLAYER, pressed-in active state, locked during any live battle), pvp room strip (ROOM code + names + red LEAVE), main swaps GameBoard / PvpLobby (form + waiting states) / PvpGameBoard, footer log per mode, overlays per mode (BattleModal|PvpBattleModal, GameOverModal|PvpGameOverModal), shared Rules/Stats/Sound
- Fixed leaveRoom UX bug found in E2E: leaving used to disconnect the socket entirely (lobby stuck on CONNECTING forever) — now emits ROOM_LEAVE and keeps the socket alive for instant lobby reuse

Stage Summary:
- VS CPU game untouched; VS PLAYER rides the same shell, footer and modals

---
Task ID: 4 (Phase 2)
Agent: main (Z.ai Code)
Task: Lint, service start, log checks

Work Log:
- bun run lint → 0 errors, 0 warnings
- Started mini-service: cd mini-services/uno-pvp && nohup bun run dev (port 3005, log at mini-services/uno-pvp/service.log)
- dev.log clean (all 200s); service log shows clean boot + room lifecycle

Stage Summary:
- Both servers running: Next.js :3000 (dev) + uno-pvp :3005

---
Task ID: 5 (Phase 2)
Agent: main (Z.ai Code)
Task: Agent-browser two-session E2E of a full PvP match

Work Log:
- KEY FINDING: localhost:3000 bypasses the Caddy gateway so XTransformPort never fires — the app MUST be tested (and previewed) through the gateway origin; http://localhost:81 is the internal equivalent of the preview panel URL
- Two isolated browser sessions (p1=ACE, p2=REX) through the gateway: socket.io connects, lobby form renders
- ACE creates room (code XV28) → REX joins → match auto-starts, random first player, 7/7 cards, 42 deck, number-only top; matching rules correct (numbers disabled when off, actions always enabled)
- Sudden Card Battle: modals appear in BOTH sessions; first battle auto-resolved 0—0 tie (both drew 2); second battle mashed 2—2 via browser clicks from both players (scores + penalty verified in log)
- WILDFIRE (+1 both), SKIP (goes again), SWAP (hands exchanged), +2/MEGA +4 (draw + skip), number matching, UNO shouts, draw flow (PLAY IT/KEEP prompt, auto-pass) all verified live
- CHAOS FRENZY: hit 100% → DECK EXPLOSION fired with banner + meter reset (twice across the match)
- Full match to game over: ACE emptied hand → YOU WIN!/YOU LOSE… modals on respective sides; REMATCH instantly re-dealt for both (REMATCH! + new VS log line)
- PvP stats recorded + isolated per player (localStorage p1: 1W/0L, p2: 0W/1L; later forfeit win → 2W); stats modal PVP RECORD row renders (100% WIN RATE chip)
- Forfeit both directions: LEAVE mid-match → opponent gets VICTORY BY FORFEIT modal without REMATCH (opponent gone); leaving returns to a live lobby (after the leaveRoom fix)
- Mode switch back to VS CPU: difficulty toolbar + START GAME + full CPU game intact; mode buttons lock during live battles
- Responsiveness: mobile 390px (no horizontal overflow, footer below the fold, DOM-verified mainBottom === footerTop = no overlap, reachable on scroll) + desktop 1280px (VLM-reviewed, all sections clean)
- Zero page errors, zero console errors on both sessions; final lint 0/0; browsers closed, rooms destroyed in service log

Stage Summary:
- Browser-verified end-to-end: create → join → play → battle (both mashing) → chaos → win → rematch → forfeit → stats. Golden path complete.

---
Task ID: 6 (Phase 2)
Agent: main (Z.ai Code)
Task: Finalize worklog and deliver report

Work Log:
- Appended Phase 2 sections; verified both servers running; delivered user report

Stage Summary:
- UNO FRENZY now supports ONLINE PVP MATCHES via VS PLAYER mode — playable through the Preview Panel (one player can also open a second tab, or a friend can join from their own preview session with the room code)

---
Task ID: 7-a / 7-b / 7-c / 7-d (Phase 3)
Agent: main (Z.ai Code)
Task: Convert UNO FRENZY into a pure static website (index.html + style.css + script.js at workspace root) for GitHub Pages — user will copy the workspace to GitHub, so the online socket.io PvP (impossible on static hosting) is replaced by LOCAL hot-seat multiplayer for 2–4 players

Work Log:
- Read worklog + existing React implementation (engine.ts, types.ts, sound.ts, stats.ts, use-uno-game.ts, game-card.tsx, rules-modal.tsx) to port rules/sounds/AI 1:1
- Created /index.html — all screens (menu, setup, game), overlays (pass-device, drawn-card, swap-target, battle, chaos banner, game-over), rules/stats/quit modals, top ticker; relative asset paths only (GH Pages subpath-safe)
- Created /style.css — neo-brutalist (yellow #ffea00/#ffd600, 4px black borders, hard offset shadows, Impact/Arial Black + Courier New, zero external fonts/CDNs), responsive (mobile 390px → desktop), sticky footer via flex + mt-auto, custom scrollbars, reduced-motion support
- Created /script.js — full vanilla-JS game: 57-card deck, matching rules (actions always playable, any number answers an action), N-player turn engine generalized from the 1v1 engine (REVERSE 2p = bounce-back, 3p+ = flip direction; SKIP/+2/+4 skip next), SHIELD raise/absorb, SWAP with victim picker (3+ players) or auto (2p), WILDFIRE, BATTLE 3s mash minigame (human sides via pointer + keyboard A S D F / J K L ;, AI mash rates 3.2/6.0/9.2 per difficulty), chaos meter +8%/card with DRAW RAIN / DECK EXPLOSION / TOP CARD MORPH, AI brains (easy/chaotic/insane) ported + generalized, Web Audio synth (all 18 sounds ported 1:1), per-name career stats in localStorage, hot-seat privacy gate (PASS THE DEVICE overlay between human turns, hand hidden until confirmed), quit/rematch flows, debug hook window.__UF
- Rewrote /src/app/page.tsx as a server component that reads the 3 root files and inlines them — the / preview shows EXACTLY the static site that ships (single source of truth, no duplication); old React components/hooks left in place but unused by /
- Created /README.md with GitHub Pages deploy steps

Stage Summary:
- Static trio at workspace root is the real deliverable: copy index.html/style.css/script.js (+ README) to a GitHub repo → enable Pages → done. Zero servers, zero deps, zero build.

---
Task ID: 8 / 9 / 10 (Phase 3)
Agent: main (Z.ai Code)
Task: Lint, dev.log check, agent-browser E2E verification, fixes, and final delivery

Work Log:
- `bun run lint` → 0 problems; dev.log clean (GET / 200, no runtime errors); served page verified to inline all 3 files (340KB HTML)
- E2E via agent-browser (desktop 1280×800 + mobile 390×844):
  - Menu, VS CPU setup (INSANE), game start: hand of 7 rendered, playable/dim classes correct
  - SWAP in 1v1 auto-swaps + logs; 4-player hot-seat: names KAI/ZOE + 2 CPU seats, PASS THE DEVICE gate shows for each human turn, hand reveals only after confirm
  - +2 in 4p: victim draws 2 and is skipped; CPU turns animate with delays
  - SWAP victim picker (4p): lists all 3 opponents with card counts; hands exchanged (10⇄6 verified in state + log)
  - BATTLE minigame: countdown 3-2-1-GO, human tap registered (counter 0→1), INSANE CPU auto-mashed 26–28 (rate-correct), result banner, loser drew 4, battlesWon recorded
  - Chaos event forced via window.__UF.forceChaos(): DRAW RAIN → everyone drew 2, meter reset, banner + shake
  - Game over: winner panel + per-player rows + confetti; career stats table correct (KAI 1-0 streak 1, battles per name)
  - Rules modal (5 sections), stats modal + 2-step reset, sound toggle persisted, quit confirm aborts a live battle cleanly
- Fixed mobile layout: pile label "DECK — TAP TO DRAW" was forcing the table to wrap → renamed to "DRAW PILE" + tightened mobile paddings → page now fits 390×844 with ZERO scroll, battle log pinned to bottom edge (844=844)
- Sticky footer verified: menu footer bottom === viewport bottom; game log bottom === viewport bottom; no overlap
- VLM visual QA on desktop + mobile screenshots: PASS on all items (no overlap, cards render, layout clean, footer pinned)
- Zero browser console/page errors; appended worklog; delivered report

Stage Summary:
- UNO FRENZY is now a fully static, GitHub-Pages-ready website with local multiplayer (2–4 players hot-seat + optional CPU seats). Everything browser-verified end-to-end.
