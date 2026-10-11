/* ═══════════════════════════════════════════════════════════════
   UNO FRENZY — static vanilla-JS game engine
   100% client-side · no server · GitHub Pages ready
   Modes: VS CPU (3 difficulties) · Local PvP 2-4 players (hot-seat)
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

// ─────────────────────────────────────────────────────────────
// CONFIG (ported 1:1 from the game spec)
// ─────────────────────────────────────────────────────────────
const STARTING_HAND = 7;
const FRENZY_PER_CARD = 8;          // % meter charge per card played
const BATTLE_MS = 3000;             // sudden card battle length
const BATTLE_PENALTY = 4;           // loser draws 4
const BATTLE_TIE_PENALTY = 2;       // tie: both draw 2
const BANNER_MS = 1800;             // chaos banner duration

const AI_BATTLE_RATES = { easy: 3.2, chaotic: 6.0, insane: 9.2 };   // taps/sec
const AI_DRAWN_PLAY = { easy: 0.5, chaotic: 0.75, insane: 1 };      // play drawn card?
const AI_DELAY = {
  easy: [1400, 600], chaotic: [900, 600], insane: [480, 420],
}; // [base, jitter]

const STATS_KEY = 'uno-frenzy-stats-v1';   // { NAME: career }
const SOUND_KEY = 'uno-frenzy-sound-v1';

const ACTIONS = {
  skip:     { icon: '⊘',  label: 'SKIP',     name: 'SKIP' },
  reverse:  { icon: '⟲',  label: 'REVERSE', name: 'REVERSE' },
  draw2:    { icon: '+2', label: 'PENALTY', name: '+2' },
  draw4:    { icon: '+4', label: 'MEGA',    name: 'MEGA +4' },
  swap:     { icon: '⇄',  label: 'SWAP',     name: 'SWAP' },
  wildfire: { icon: '🔥', label: 'WILDFIRE', name: 'WILDFIRE' },
  shield:   { icon: '🛡', label: 'SHIELD',   name: 'SHIELD' },
  battle:   { icon: '⚔',  label: 'BATTLE',   name: 'BATTLE' },
};
const CARD_SOUNDS = {
  number: 'card', skip: 'skip', reverse: 'reverse', draw2: 'penalty',
  draw4: 'penalty', swap: 'swap', wildfire: 'wildfire', shield: 'shield',
  battle: 'battle',
};
const KIND_ORDER = ['skip', 'reverse', 'draw2', 'draw4', 'swap', 'wildfire', 'shield', 'battle'];

const CHAOS_META = {
  'draw-rain': { name: 'DRAW RAIN', desc: 'EVERYONE DRAWS 2' },
  reshuffle:   { name: 'DECK EXPLOSION', desc: 'DISCARDS BLAST BACK INTO THE DECK' },
  morph:       { name: 'TOP CARD MORPH', desc: 'THE PILE SHAPESHIFTS' },
};

const LEFT_KEYS = new Set(['a', 's', 'd', 'f']);
const RIGHT_KEYS = new Set(['j', 'k', 'l', ';']);

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mod = (i, n) => ((i % n) + n) % n;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────
// SOUND — Web Audio arcade synth (fully synthesized, no assets)
// ─────────────────────────────────────────────────────────────
const SFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.28;
        master.connect(ctx.destination);
      } catch { return false; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  function tone(f0, f1, dur, type = 'square', vol = 1, delay = 0) {
    if (muted || !ensure() || !ctx || !master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, f0), t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function noise(dur, vol = 0.6, delay = 0, cutoff = 1200) {
    if (muted || !ensure() || !ctx || !master) return;
    const t0 = ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t0);
  }
  function seq(notes, type = 'square', vol = 1, gap = 0) {
    let d = 0;
    for (const [f, dur] of notes) { tone(f, f, dur, type, vol, d); d += dur + gap; }
  }
  return {
    get muted() { return muted; },
    set muted(v) { muted = v; },
    unlock() { ensure(); },
    card() { tone(320, 520, 0.07); },
    draw() { tone(260, 170, 0.09); },
    click() { tone(400, 400, 0.035, 'square', 0.6); },
    skip() { tone(560, 560, 0.05); tone(380, 380, 0.06, 'square', 1, 0.06); },
    reverse() { tone(220, 700, 0.16, 'sawtooth', 0.8); },
    penalty() { tone(170, 70, 0.22, 'sawtooth', 0.9); noise(0.12, 0.3, 0.02); },
    shield() { tone(880, 880, 0.09, 'triangle'); tone(1320, 1320, 0.16, 'triangle', 0.8, 0.07); },
    swap() { tone(420, 760, 0.07); tone(760, 420, 0.07, 'square', 1, 0.09); },
    wildfire() { noise(0.28, 0.7, 0, 900); tone(200, 90, 0.25, 'sawtooth', 0.5); },
    battle() { seq([[523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.14]]); },
    mash() { tone(760, 900, 0.025, 'square', 0.5); },
    countdown() { tone(880, 880, 0.07, 'square', 0.8); },
    go() { tone(1320, 1320, 0.16, 'square', 1); },
    chaos() {
      for (let i = 0; i < 4; i++) tone(i % 2 ? 620 : 880, i % 2 ? 620 : 880, 0.1, 'square', 0.9, i * 0.11);
      noise(0.3, 0.4, 0.1);
    },
    uno() { seq([[784, 0.07], [988, 0.07], [1175, 0.12]]); },
    win() { seq([[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.16], [1318, 0.22]]); },
    lose() { seq([[440, 0.12], [370, 0.12], [311, 0.12], [233, 0.24]], 'sawtooth', 0.8); },
    shuffle() { for (let i = 0; i < 5; i++) tone(180 + Math.random() * 320, 180, 0.04, 'square', 0.5, i * 0.045); },
  };
})();

// ─────────────────────────────────────────────────────────────
// CAREER STATS — localStorage, keyed by player name
// ─────────────────────────────────────────────────────────────
function loadCareer() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {}; } catch { return {}; }
}
function saveCareer(d) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}
function updCareer(name, fn) {
  const d = loadCareer();
  const e = d[name] || (d[name] = { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, battlesWon: 0 });
  fn(e);
  saveCareer(d);
}

// ─────────────────────────────────────────────────────────────
// DECK & RULES
// ─────────────────────────────────────────────────────────────
let cardSeq = 0;
const makeCard = (kind, value) => ({ id: `c${++cardSeq}`, kind, value });

function buildDeck() {
  const deck = [];
  for (let v = 0; v <= 9; v++) for (let i = 0; i < 3; i++) deck.push(makeCard('number', v));
  const spec = [['skip', 4], ['reverse', 4], ['draw2', 4], ['draw4', 3], ['swap', 3], ['wildfire', 3], ['shield', 3], ['battle', 3]];
  for (const [kind, n] of spec) for (let i = 0; i < n; i++) deck.push(makeCard(kind, null));
  return shuffle(deck);
}
const isAction = (c) => c.kind !== 'number';
function isPlayable(card, top) {
  if (!top) return true;
  if (isAction(card)) return true;                 // actions are ALWAYS playable
  if (top.kind !== 'number') return true;          // any number answers an action
  return card.value === top.value;                 // number matches number
}
function cardName(c) {
  return c.kind === 'number' ? String(c.value) : ACTIONS[c.kind].name;
}
const makeRandomNumberCard = () => makeCard('number', Math.floor(Math.random() * 10));

// ─────────────────────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────────────────────
let S = null;        // current match state
let G = 0;           // generation token — invalidates stale async flows
let lastTopId = null;
let topRot = 0;
let battleCtl = null;

const cur = () => S.players[S.current];
const nextPlayer = () => S.players[mod(S.current + S.dir, S.players.length)];
const humansCount = () => S.players.filter((p) => !p.isAI).length;

function newGame(cfg) {
  G++;
  const players = cfg.seats.map((s, i) => ({
    id: `p${i}`,
    seat: i,
    name: (String(s.name || `P${i + 1}`).trim().toUpperCase().slice(0, 12)) || `P${i + 1}`,
    isAI: !!s.isAI,
    difficulty: s.difficulty || 'chaotic',
    hand: [], shield: false, battlesWon: 0, cardsPlayed: 0, drew: 0,
  }));
  // unique names (append seat number on clashes)
  const seen = new Set();
  players.forEach((p, i) => {
    if (seen.has(p.name)) p.name = `${p.name.slice(0, 9)} ${i + 1}`;
    seen.add(p.name);
  });

  const deck = buildDeck();
  players.forEach((p) => { p.hand = deck.splice(0, STARTING_HAND); });
  const fi = deck.findIndex((c) => c.kind === 'number');   // first discard = number
  const top = deck.splice(fi, 1)[0];

  S = {
    mode: cfg.mode,
    players, deck, discard: [top], top,
    current: cfg.mode === 'cpu' ? 0 : Math.floor(Math.random() * players.length),
    dir: 1, skipNext: false, chaos: 0, turn: 1,
    over: false, lastActorId: null, revealed: false, drawnThisTurn: false, lock: false,
    cfg,
  };
  lastTopId = null;
  $('#log-entries').innerHTML = '';
  showScreen('game');
  const desc = cfg.mode === 'cpu'
    ? `VS ${players[1].name} — ${players[1].difficulty.toUpperCase()} MODE`
    : `${players.length}-PLAYER LOCAL FRENZY`;
  log(`NEW GAME — ${desc}. ${players[S.current].name} GOES FIRST!`, 'win');
  renderAll();
  beginTurn();
}

// ─────────────────────────────────────────────────────────────
// TURN ENGINE
// ─────────────────────────────────────────────────────────────
async function beginTurn() {
  if (!S || S.over) return;
  const g = G;
  S.drawnThisTurn = false;
  S.revealed = false;
  renderAll();
  const p = cur();
  if (p.isAI) {
    await sleep(AI_DELAY[p.difficulty][0] + Math.random() * AI_DELAY[p.difficulty][1]);
    if (!S || S.over || G !== g) return;
    await aiAct(p, g);
  } else {
    if (S.mode === 'pvp' && humansCount() >= 2 && S.lastActorId !== p.id) {
      await showPassOverlay(p);
      if (!S || S.over || G !== g) return;
    }
    S.revealed = true;
    renderAll();
  }
}

async function endTurn() {
  if (!S || S.over) return;
  const g = G;
  S.lastActorId = cur().id;
  const steps = S.skipNext ? 2 : 1;
  S.skipNext = false;
  S.current = mod(S.current + S.dir * steps, S.players.length);
  S.turn++;
  await sleep(380);
  if (!S || S.over || G !== g) return;
  beginTurn();
}

async function commitHumanPlay(p, card) {
  // returns false when a swap was cancelled (card stays in hand)
  const g = G;
  let swapTarget = null;
  if (card.kind === 'swap' && S.players.length > 2) {
    swapTarget = await pickSwapTarget(p);
    if (!swapTarget) return false;
  }
  if (!S || S.over || G !== g) return true;
  await playCard(p, card, swapTarget);
  return true;
}

async function humanPlay(cardId) {
  if (!S || S.over || S.lock) return;
  const p = cur();
  if (p.isAI || !S.revealed) return;
  const card = p.hand.find((c) => c.id === cardId);
  if (!card || !isPlayable(card, S.top)) { SFX.click(); return; }
  S.lock = true;
  const ok = await commitHumanPlay(p, card);
  S.lock = false;
  if (!ok) { renderHand(); return; }
  if (!S || S.over) return;
  await endTurn();
}

async function humanDraw() {
  if (!S || S.over || S.lock || S.drawnThisTurn) return;
  const p = cur();
  if (p.isAI || !S.revealed) return;
  S.lock = true;
  S.drawnThisTurn = true;
  const g = G;
  const card = drawCard();
  if (!card) {
    log(`${nameTag(p)} can't draw — the deck is DRY. Turn passes.`, 'info');
  } else {
    p.hand.push(card);
    p.drew++;
    log(`${nameTag(p)} draws a card`, 'info');
    SFX.draw();
    renderAll();
    if (isPlayable(card, S.top)) {
      const choice = await drawnPrompt(card);
      if (!S || S.over || G !== g) { S.lock = false; return; }
      if (choice === 'play') {
        const ok = await commitHumanPlay(p, card);
        S.lock = false;
        if (!ok) { renderHand(); return; }  // swap cancelled → still keeps card
        if (!S || S.over) return;
        await endTurn();
        return;
      }
      log(`${nameTag(p)} keeps the drawn card`, 'info');
    } else {
      await sleep(420);
    }
  }
  S.lock = false;
  if (!S || S.over) return;
  await endTurn();
}

// ─────────────────────────────────────────────────────────────
// PLAYING CARDS & EFFECTS
// ─────────────────────────────────────────────────────────────
async function playCard(p, card, swapTarget) {
  const g = G;
  p.hand = p.hand.filter((c) => c.id !== card.id);
  S.discard.push(card);
  S.top = card;
  p.cardsPlayed++;
  log(`${nameTag(p)} play${p.isAI ? 's' : ''} ${cardName(card)}!`, 'play');
  SFX[CARD_SOUNDS[card.kind]]();
  renderAll();
  if (p.hand.length === 0) { win(p); return; }
  S.chaos = Math.min(100, S.chaos + FRENZY_PER_CARD);
  renderMeter();
  if (p.hand.length === 1) {
    log(`⚡ ${nameTag(p)} has ONE card left — UNO!`, 'win');
    SFX.uno();
    renderPlayers();
  }
  await sleep(280);
  if (!S || S.over || G !== g) return;
  await applyEffects(p, card, swapTarget, g);
  if (!S || S.over || G !== g) return;
  if (S.chaos >= 100) await triggerChaos(g);
}

async function applyEffects(p, card, swapTarget, g) {
  const n = S.players.length;
  switch (card.kind) {
    case 'skip': {
      S.skipNext = true;
      if (n === 2) log(`SKIP — the turn bounces right back to ${p.name}!`, 'info');
      else log(`${nextPlayer().name} is SKIPPED!`, 'info');
      SFX.skip();
      break;
    }
    case 'reverse': {
      if (n === 2) {
        S.skipNext = true;
        log(`REVERSE — the turn bounces right back to ${p.name}!`, 'info');
      } else {
        S.dir *= -1;
        log(`REVERSE — turn order flips ${S.dir === 1 ? '▶▶' : '◀◀'}!`, 'info');
        renderTurn();
      }
      SFX.reverse();
      break;
    }
    case 'draw2':
    case 'draw4': {
      const victim = nextPlayer();
      const cnt = card.kind === 'draw2' ? 2 : 4;
      log(`${cardName(card)} — ${victim.name} draws ${cnt} and is SKIPPED!`, 'penalty');
      await applyPenalty(victim, cnt, 'penalty', g);
      S.skipNext = true;
      break;
    }
    case 'swap': {
      const target = swapTarget || aiSwapTarget(p);
      const t = target.hand;
      target.hand = p.hand;
      p.hand = t;
      log(`HANDS SWAPPED — ${p.name} ⇄ ${target.name}. Chaos reigns!`, 'chaos');
      SFX.swap();
      renderAll();
      await sleep(340);
      break;
    }
    case 'wildfire': {
      log('🔥 WILDFIRE — everyone draws 1!', 'chaos');
      SFX.wildfire();
      for (const q of S.players) {
        await applyPenalty(q, 1, 'wildfire', g);
        if (!S || S.over || G !== g) return;
      }
      break;
    }
    case 'shield': {
      p.shield = true;
      log(`${nameTag(p)} raises a 🛡 SHIELD!`, 'shield');
      SFX.shield();
      renderPlayers();
      await sleep(300);
      break;
    }
    case 'battle': {
      const foe = nextPlayer();
      log(`SUDDEN CARD BATTLE — ${p.name} ⚔ ${foe.name}!`, 'battle');
      const res = await runBattle(p, foe);
      if (!S || S.over || G !== g || !res) return;
      if (res.tie) {
        log(`BATTLE TIE ${res.aCount}—${res.bCount} — both draw ${BATTLE_TIE_PENALTY}!`, 'battle');
        await applyPenalty(p, BATTLE_TIE_PENALTY, 'battle tie', g);
        if (!S || S.over || G !== g) return;
        await applyPenalty(foe, BATTLE_TIE_PENALTY, 'battle tie', g);
      } else {
        log(`${res.winner.name} WINS THE BATTLE ${res.aCount}—${res.bCount}!`, 'battle');
        res.winner.battlesWon++;
        updCareer(res.winner.name, (e) => { e.battlesWon++; });
        await applyPenalty(res.loser, BATTLE_PENALTY, 'battle loss', g);
      }
      break;
    }
  }
}

function drawCard() {
  if (!S.deck.length) {
    const top = S.top;
    const rest = S.discard.filter((c) => c.id !== top.id);
    if (!rest.length) return null;
    S.deck = shuffle(rest);
    S.discard = [top];
    log('♻ Deck empty — the discards blast back into the deck!', 'chaos');
    SFX.shuffle();
    renderPiles();
  }
  return S.deck.pop();
}

async function applyPenalty(target, count, reason, g) {
  if (target.shield) {
    target.shield = false;
    log(`🛡 ${target.name}'s SHIELD absorbs the attack — no cards drawn!`, 'shield');
    SFX.shield();
    renderPlayers();
    await sleep(380);
    return;
  }
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    const c = drawCard();
    if (!c) { log('The deck is DRY — no more cards!', 'info'); break; }
    target.hand.push(c);
    target.drew++;
    drawn++;
  }
  if (drawn > 0) log(`${nameTag(target)} draws ${drawn} (${reason})`, 'penalty');
  SFX.penalty();
  renderAll();
  await sleep(drawn > 1 ? 420 : 260);
  if (!S || G !== g) return;
}

// ─────────────────────────────────────────────────────────────
// CHAOS FRENZY EVENTS
// ─────────────────────────────────────────────────────────────
async function triggerChaos(g) {
  S.chaos = 0;
  renderMeter();
  const roll = Math.random();
  const ev = roll < 0.4 ? 'draw-rain' : roll < 0.7 ? 'reshuffle' : 'morph';
  const meta = CHAOS_META[ev];
  SFX.chaos();
  shakeScreen();
  flashRed();
  showChaosBanner(meta);
  await sleep(BANNER_MS);
  hideChaosBanner();
  if (!S || S.over || G !== g) return;

  if (ev === 'draw-rain') {
    for (const q of S.players) {
      await applyPenalty(q, 2, 'draw rain', g);
      if (!S || S.over || G !== g) return;
    }
  } else if (ev === 'reshuffle') {
    const top = S.top;
    S.deck = shuffle([...S.deck, ...S.discard.filter((c) => c.id !== top.id)]);
    S.discard = [top];
    log('💥 DECK EXPLOSION — the discard pile blasts back into the deck!', 'chaos');
    renderPiles();
    await sleep(320);
  } else {
    let morph;
    if (S.deck.length) morph = S.deck.splice(Math.floor(Math.random() * S.deck.length), 1)[0];
    else morph = makeRandomNumberCard();
    S.discard.push(morph);
    S.top = morph;
    log(`🧬 TOP CARD MORPH — the pile shapeshifts into ${cardName(morph)}!`, 'chaos');
    shakeScreen();
    renderAll();
    await sleep(320);
  }
}

function showChaosBanner(meta) {
  $('#chaos-name').textContent = meta.name;
  $('#chaos-desc').textContent = meta.desc;
  $('#chaos-overlay').classList.remove('hidden');
}
function hideChaosBanner() { $('#chaos-overlay').classList.add('hidden'); }

// ─────────────────────────────────────────────────────────────
// AI BRAIN (ported, generalized to N players)
// ─────────────────────────────────────────────────────────────
function chooseAiCard(p, playable) {
  if (!playable.length) return null;
  if (p.difficulty === 'easy') return pick(playable);           // sloppy random play
  if (p.difficulty === 'chaotic') {                             // action-card spam
    const acts = playable.filter(isAction);
    return pick(acts.length ? acts : playable);
  }
  // INSANE — tactical
  const victim = nextPlayer();
  const find = (...kinds) => playable.find((c) => kinds.includes(c.kind));
  if (victim.hand.length <= 2) {
    return find('draw4', 'draw2', 'skip', 'reverse') ?? find('battle', 'swap', 'wildfire')
      ?? find('shield') ?? pick(playable);
  }
  const numbers = playable.filter((c) => c.kind === 'number');
  if (numbers.length) return pick(numbers);                     // dump numbers while safe
  if (p.hand.length >= 6) {
    return find('swap', 'wildfire', 'shield', 'battle') ?? pick(playable); // shed neutrals
  }
  return pick(playable);
}
function aiSwapTarget(p) {
  const others = S.players.filter((q) => q !== p);
  if (p.difficulty === 'insane') return others.slice().sort((a, b) => a.hand.length - b.hand.length)[0];
  return pick(others);
}
async function aiAct(p, g) {
  if (!S || S.over || G !== g) return;
  const playable = p.hand.filter((c) => isPlayable(c, S.top));
  const card = chooseAiCard(p, playable);
  if (!card) {
    const c = drawCard();
    if (!c) {
      log(`${nameTag(p)} can't draw — deck is DRY. Turn passes.`, 'info');
    } else {
      p.hand.push(c);
      p.drew++;
      log(`${nameTag(p)} draws a card`, 'info');
      SFX.draw();
      renderAll();
      if (isPlayable(c, S.top) && Math.random() < AI_DRAWN_PLAY[p.difficulty]) {
        await sleep(650);
        if (!S || S.over || G !== g) return;
        await playCard(p, c, null);
        if (!S || S.over) return;
        await endTurn();
        return;
      }
    }
  } else {
    const swapTarget = card.kind === 'swap' ? aiSwapTarget(p) : null;
    await playCard(p, card, swapTarget);
  }
  if (!S || S.over || G !== g) return;
  await endTurn();
}

// ─────────────────────────────────────────────────────────────
// SUDDEN CARD BATTLE — 3-second tap war
// ─────────────────────────────────────────────────────────────
function runBattle(a, b) {
  return new Promise((resolve) => {
    const ov = $('#battle-overlay');
    const cdEl = $('#battle-result');
    const sideEls = [
      { box: $('#bs-left') },
      { box: $('#bs-right') },
    ];
    const players = [a, b];
    const counts = [0, 0];
    let phase = 'count';
    const timeouts = [];
    const intervals = [];
    const t = (fn, ms) => { const id = setTimeout(fn, ms); timeouts.push(id); };

    const cleanup = () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      ov.classList.add('hidden');
      $('#battle-countdown').classList.add('hidden');
      $('#battle-result').classList.add('hidden');
      battleCtl = null;
    };
    const finish = (res) => { cleanup(); resolve(res); };

    sideEls.forEach((el, i) => {
      el.name = $('.bs-name', el.box);
      el.count = $('.bs-count', el.box);
      el.bar = $('.bs-bar', el.box);
      el.name.textContent = players[i].name;
      el.count.textContent = '0';
      el.bar.style.width = '0%';
      el.box.querySelector('.bs-hint').style.visibility = players[i].isAI ? 'hidden' : 'visible';
      el.box.onpointerdown = (e) => { e.preventDefault(); tap(i); };
    });
    $('#battle-sub').textContent = 'MASH YOUR SIDE — MOST TAPS IN 3 SECONDS WINS! LOSER DRAWS 4!';
    ov.classList.remove('hidden');
    SFX.battle();

    const update = () => {
      sideEls.forEach((el, i) => {
        el.count.textContent = String(Math.floor(counts[i]));
        const lead = Math.max(counts[0], counts[1], 10);
        el.bar.style.width = `${Math.round((counts[i] / lead) * 100)}%`;
      });
    };
    const tap = (i) => {
      if (phase !== 'mash' || players[i].isAI) return;
      counts[i] += 1;
      SFX.mash();
      update();
    };
    battleCtl = {
      abort: () => finish(null),
      tap,
      get phase() { return phase; },
    };

    // 3… 2… 1… GO!
    const seq = ['3', '2', '1', 'GO!'];
    const cd = $('#battle-countdown');
    let si = 0;
    const step = () => {
      cd.textContent = seq[si];
      cd.classList.remove('hidden');
      cd.style.animation = 'none';
      void cd.offsetWidth;               // retrigger pop animation
      cd.style.animation = '';
      SFX[seq[si] === 'GO!' ? 'go' : 'countdown']();
      si++;
      if (si < seq.length) t(step, 620);
      else t(startMash, 480);
    };
    t(step, 620);

    const startMash = () => {
      cd.classList.add('hidden');
      phase = 'mash';
      players.forEach((pl, i) => {
        if (!pl.isAI) return;
        const rate = AI_BATTLE_RATES[pl.difficulty] || 5;
        intervals.push(setInterval(() => {
          if (phase !== 'mash') return;
          counts[i] += (rate / 10) * (0.75 + Math.random() * 0.5);
          update();
        }, 100));
      });
      t(endMash, BATTLE_MS);
    };
    const endMash = () => {
      if (phase !== 'mash') return;
      phase = 'done';
      const A = Math.floor(counts[0]);
      const B = Math.floor(counts[1]);
      const tie = A === B;
      const winner = tie ? null : (A > B ? a : b);
      const loser = tie ? null : (A > B ? b : a);
      const resEl = $('#battle-result');
      resEl.textContent = tie
        ? `DEAD HEAT ${A}—${B}! BOTH DRAW!`
        : `${winner.name.toUpperCase()} WINS ${Math.max(A, B)}—${Math.min(A, B)}!`;
      resEl.className = tie ? 'r-tie' : '';
      resEl.classList.remove('hidden');
      SFX[tie ? 'penalty' : 'win']();
      t(() => finish(tie ? { tie: true, aCount: A, bCount: B } : { winner, loser, aCount: A, bCount: B }), 1700);
    };
  });
}

// ─────────────────────────────────────────────────────────────
// WIN / GAME OVER
// ─────────────────────────────────────────────────────────────
function win(p) {
  S.over = true;
  SFX.win();
  log(`🏆 ${nameTag(p)} WINS THE FRENZY!`, 'win');
  for (const q of S.players) {
    updCareer(q.name, (e) => {
      if (q === p) {
        e.wins++;
        e.currentStreak++;
        e.bestStreak = Math.max(e.bestStreak, e.currentStreak);
      } else {
        e.losses++;
        e.currentStreak = 0;
      }
    });
  }
  renderAll();
  confetti();
  setTimeout(() => { if (S && S.over) showGameOver(p); }, 950);
}

function showGameOver(p) {
  $('#go-name').textContent = p.name;
  const rows = [...S.players].sort((x, y) => (x === p ? -1 : y === p ? 1 : x.hand.length - y.hand.length));
  $('#go-stats').innerHTML = rows.map((q) => `
    <div class="go-row ${q === p ? 'is-winner' : ''}">
      <span class="go-row-name">${q === p ? '🏆 ' : ''}${esc(q.name)}${q.isAI ? ' 🤖' : ''}</span>
      <span>${q === p ? 'CHAMPION' : `${q.hand.length} left`} · played ${q.cardsPlayed} · battles ${q.battlesWon}</span>
    </div>`).join('');
  $('#gameover-overlay').classList.remove('hidden');
}

function confetti() {
  const wrap = document.createElement('div');
  wrap.className = 'confetti-wrap';
  const bits = ['🎉', '🎊', '🃏', '⭐', '💛', '⚡'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.className = 'cf';
    s.textContent = pick(bits);
    s.style.left = `${Math.random() * 100}vw`;
    s.style.setProperty('--dx', `${Math.random() * 220 - 110}px`);
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    s.style.animationDuration = `${1 + Math.random() * 1.3}s`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3400);
}

// ─────────────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────────────
function cardHTML(c, o = {}) {
  const attrs = `${o.id ? ` data-id="${c.id}"` : ''}${o.style ? ` style="${o.style}"` : ''}`
    + (o.tab ? ` role="button" tabindex="0" aria-label="Play ${esc(cardName(c))}"` : '');
  const cls = `${c.kind === 'number' ? 'num' : 'act'} ${o.cls || ''}`;
  if (c.kind === 'number') {
    return `<div class="card ${cls}"${attrs}>
      <span class="corner tl">${c.value}</span>
      <span class="big">${c.value}</span>
      <span class="sub-yellow">YELLOW</span>
      <span class="corner br">${c.value}</span>
    </div>`;
  }
  const a = ACTIONS[c.kind];
  return `<div class="card ${cls}"${attrs}>
    <span class="corner tl">${a.icon}</span>
    <span class="aicon">${a.icon}</span>
    <span class="alabel">${a.label}</span>
    <span class="corner br">${a.icon}</span>
  </div>`;
}

const nameTag = (p) => `<span class="tag t${p.seat}">${esc(p.name)}</span>`;

function log(text, kind = 'info') {
  const box = $('#log-entries');
  box.insertAdjacentHTML('afterbegin', `<div class="log-line k-${kind}">${text}</div>`);
  while (box.children.length > 60) box.removeChild(box.lastChild);
}

function sortHand(hand) {
  return [...hand].sort((x, y) => {
    if (x.kind === 'number' && y.kind === 'number') return x.value - y.value;
    if (x.kind === 'number') return -1;
    if (y.kind === 'number') return 1;
    return KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind);
  });
}

function renderAll() {
  renderPlayers();
  renderPiles();
  renderTurn();
  renderMeter();
  renderHand();
  renderHeader();
}

function renderHeader() {
  const mode = S.mode === 'cpu'
    ? `VS ${S.players[1].difficulty.toUpperCase()} CPU`
    : `LOCAL PVP · ${S.players.length}P`;
  $('#gh-mode').textContent = mode;
  $('#log-mode').textContent = mode;
}

function renderPlayers() {
  $('#players-row').innerHTML = S.players.map((p, i) => `
    <div class="pchip seat-${i} ${i === S.current ? 'current' : ''}">
      <span class="pchip-name">${esc(p.name)}</span>
      <span class="pchip-count">${p.hand.length}</span>
      <span class="pchip-flags">
        ${p.isAI ? '<span class="flag ai" title="CPU">🤖</span>' : ''}
        ${p.shield ? '<span class="flag shieldf" title="Shield active">🛡</span>' : ''}
        ${p.hand.length === 1 ? '<span class="flag uno">UNO!</span>' : ''}
      </span>
    </div>`).join('');
}

function renderPiles() {
  $('#deck-count').textContent = String(S.deck.length);
  const disc = $('#discard-pile');
  const unders = S.discard.slice(-4, -1);
  if (S.top.id !== lastTopId) {
    lastTopId = S.top.id;
    topRot = +(Math.random() * 10 - 5).toFixed(1);
  }
  disc.innerHTML = unders.map((c, i) => cardHTML(c, {
    cls: 'under', style: `transform:rotate(${(i - 1) * 5}deg)`,
  })).join('') + cardHTML(S.top, {
    cls: 'top pop', style: `transform:rotate(${topRot}deg)`,
  });
}

function renderTurn() {
  const p = cur();
  $('#turn-name').textContent = p.name;
  $('#turn-count').textContent = `TURN ${S.turn}`;
  $('#dir-ind').textContent = S.dir === 1 ? '▶▶' : '◀◀';
}

function renderMeter() {
  const c = S.chaos;
  const fill = $('#meter-fill');
  fill.style.width = `${c}%`;
  fill.className = `meter-fill${c >= 85 ? ' danger' : c >= 60 ? ' warn' : ''}`;
  $('#meter-pct').textContent = `${c}%`;
}

function renderHand() {
  const handEl = $('#hand');
  const label = $('#hand-label');
  const countEl = $('#hand-count');
  const hint = $('#hand-hint');
  const drawBtn = $('#btn-draw');
  const p = cur();

  const backsHTML = (n) => {
    const shown = Math.min(n, 9);
    let html = '';
    for (let i = 0; i < shown; i++) html += '<div class="card back facedown"></div>';
    if (n > 9) html += `<div class="card facedown" style="align-items:center;justify-content:center;font-family:var(--display);font-size:.8rem;">+${n - 9}</div>`;
    return html;
  };

  if (p.isAI) {
    label.textContent = `${p.name} (CPU) — THINKING…`;
    countEl.textContent = `${p.hand.length} CARDS`;
    handEl.innerHTML = backsHTML(p.hand.length);
    handEl.classList.toggle('crowded', p.hand.length > 6);
    hint.textContent = 'cpu is scheming…';
    drawBtn.disabled = true;
    return;
  }
  if (!S.revealed) {
    label.textContent = `${p.name}'S HAND — HIDDEN`;
    countEl.textContent = `${p.hand.length} CARDS`;
    handEl.innerHTML = backsHTML(p.hand.length);
    handEl.classList.toggle('crowded', p.hand.length > 6);
    hint.textContent = 'waiting for the player to confirm…';
    drawBtn.disabled = true;
    return;
  }
  const sorted = sortHand(p.hand);
  const playableCount = p.hand.filter((c) => isPlayable(c, S.top)).length;
  label.textContent = `${p.name}'S HAND`;
  countEl.textContent = `${p.hand.length} CARDS`;
  handEl.innerHTML = sorted.map((c) => (
    cardHTML(c, { id: true, tab: true, cls: isPlayable(c, S.top) ? 'playable' : 'dim' })
  )).join('');
  handEl.classList.toggle('crowded', p.hand.length > 6);
  hint.textContent = playableCount > 0 ? 'tap a glowing card to play it' : 'nothing playable — draw!';
  drawBtn.disabled = S.drawnThisTurn;
}

// ─────────────────────────────────────────────────────────────
// OVERLAY PROMPTS (promise-based)
// ─────────────────────────────────────────────────────────────
function showPassOverlay(p) {
  return new Promise((res) => {
    $('#pass-name').textContent = p.name;
    const ov = $('#pass-overlay');
    ov.classList.remove('hidden');
    const btn = $('#pass-btn');
    btn.textContent = `I'M ${p.name} — SHOW MY HAND`;
    btn.focus();
    btn.onclick = () => { SFX.click(); ov.classList.add('hidden'); res(); };
  });
}

function drawnPrompt(card) {
  return new Promise((res) => {
    $('#drawn-card').innerHTML = cardHTML(card);
    const ov = $('#drawn-overlay');
    ov.classList.remove('hidden');
    $('#drawn-play').focus();
    $('#drawn-play').onclick = () => { SFX.click(); ov.classList.add('hidden'); res('play'); };
    $('#drawn-keep').onclick = () => { SFX.click(); ov.classList.add('hidden'); res('keep'); };
  });
}

function pickSwapTarget(p) {
  return new Promise((res) => {
    const list = $('#target-list');
    list.innerHTML = S.players.filter((q) => q !== p).map((q) => `
      <button type="button" class="target-btn" data-id="${q.id}">
        <span>${esc(q.name)}${q.isAI ? ' 🤖' : ''}</span>
        <span class="tb-count">${q.hand.length} CARDS</span>
      </button>`).join('');
    const ov = $('#target-overlay');
    ov.classList.remove('hidden');
    list.onclick = (e) => {
      const b = e.target.closest('.target-btn');
      if (!b) return;
      SFX.click();
      ov.classList.add('hidden');
      res(S.players.find((q) => q.id === b.dataset.id) || null);
    };
    $('#target-cancel').onclick = () => { SFX.click(); ov.classList.add('hidden'); res(null); };
  });
}

// ─────────────────────────────────────────────────────────────
// EFFECTS — shake / flash
// ─────────────────────────────────────────────────────────────
function shakeScreen() {
  const app = $('#app');
  app.classList.remove('shake');
  void app.offsetWidth;
  app.classList.add('shake');
  setTimeout(() => app.classList.remove('shake'), 650);
}
function flashRed() {
  let f = $('#flash');
  if (!f) {
    f = document.createElement('div');
    f.id = 'flash';
    document.body.appendChild(f);
  }
  f.classList.add('on');
  setTimeout(() => f.classList.remove('on'), 200);
}

// ─────────────────────────────────────────────────────────────
// SETUP SCREENS
// ─────────────────────────────────────────────────────────────
let setup = null;
const mkSeat = (i) => ({ name: `PLAYER ${i}`, isAI: false });

function openSetup(mode) {
  setup = mode === 'cpu'
    ? { mode, name: 'YOU', difficulty: 'chaotic' }
    : { mode, count: 2, difficulty: 'chaotic', seats: [mkSeat(1), mkSeat(2)] };
  showScreen('setup');
  renderSetup();
}

function renderSetup() {
  const body = $('#setup-body');
  const diffCard = (id, title, sub) => `
    <button type="button" class="radio-card d-${id} ${setup.difficulty === id ? `sel d-${id}` : ''}" data-diff="${id}">
      ${title}<span class="rc-sub">${sub}</span>
    </button>`;

  if (setup.mode === 'cpu') {
    body.innerHTML = `
      <h2 class="panel-title">🤖 VS CPU</h2>
      <div class="field">
        <label class="field-label" for="setup-name">YOUR NAME</label>
        <input id="setup-name" class="name-input" type="text" maxlength="12" value="${esc(setup.name)}" autocomplete="off" spellcheck="false">
      </div>
      <div class="field">
        <span class="field-label">CPU DIFFICULTY</span>
        <div class="radio-row">
          ${diffCard('easy', 'EASY', 'sleepy & sloppy')}
          ${diffCard('chaotic', 'CHAOTIC', 'action-card spam')}
          ${diffCard('insane', 'INSANE', 'fast & merciless')}
        </div>
      </div>
      <div class="setup-actions">
        <button type="button" id="setup-back" class="btn btn-white">← BACK</button>
        <button type="button" id="setup-start" class="btn btn-lg">START ▶</button>
      </div>`;
    return;
  }

  const anyAI = setup.seats.some((s) => s.isAI);
  const seatsHTML = setup.seats.map((s, i) => `
    <div class="seat-row">
      <span class="seat-num">P${i + 1}</span>
      <input class="name-input seat-name-input" type="text" maxlength="12" data-seat="${i}"
        value="${esc(s.name)}" autocomplete="off" spellcheck="false" aria-label="Player ${i + 1} name">
      <div class="seg" role="group" aria-label="Seat ${i + 1} type">
        <button type="button" class="seg-btn ${s.isAI ? '' : 'sel-human'}" data-seat="${i}" data-kind="human">HUMAN</button>
        <button type="button" class="seg-btn ${s.isAI ? 'sel-ai' : ''}" data-seat="${i}" data-kind="ai">CPU</button>
      </div>
    </div>`).join('');

  body.innerHTML = `
    <h2 class="panel-title">👥 LOCAL PVP</h2>
    <div class="field">
      <span class="field-label">HOW MANY PLAYERS?</span>
      <div class="radio-row">
        ${[2, 3, 4].map((n) => `
          <button type="button" class="radio-card d-plain ${setup.count === n ? 'sel d-plain' : ''}" data-count="${n}">
            ${n} PLAYERS
          </button>`).join('')}
      </div>
    </div>
    <div class="field">
      <span class="field-label">THE CREW <span style="font-family:var(--mono);font-size:.62rem;letter-spacing:0">(name each seat · human or CPU)</span></span>
      ${seatsHTML}
    </div>
    ${anyAI ? `
    <div class="field">
      <span class="field-label">CPU DIFFICULTY</span>
      <div class="radio-row">
        ${diffCard('easy', 'EASY', 'sleepy & sloppy')}
        ${diffCard('chaotic', 'CHAOTIC', 'action-card spam')}
        ${diffCard('insane', 'INSANE', 'fast & merciless')}
      </div>
    </div>` : ''}
    <p class="setup-note">🔒 HOT-SEAT MODE — the screen hides your hand between turns: PASS THE DEVICE when the gate shows up!</p>
    <div class="setup-actions">
      <button type="button" id="setup-back" class="btn btn-white">← BACK</button>
      <button type="button" id="setup-start" class="btn btn-lg">START ▶</button>
    </div>`;
}

function setupStart() {
  if (!setup) return;
  SFX.click();
  let cfg;
  if (setup.mode === 'cpu') {
    cfg = {
      mode: 'cpu',
      seats: [
        { name: setup.name, isAI: false },
        { name: `${setup.difficulty.toUpperCase()} CPU`, isAI: true, difficulty: setup.difficulty },
      ],
    };
  } else {
    const seats = setup.seats.map((s, i) => ({
      name: (s.name || '').trim() || (s.isAI ? `CPU ${i + 1}` : `PLAYER ${i + 1}`),
      isAI: s.isAI,
      difficulty: setup.difficulty,
    }));
    cfg = { mode: 'pvp', seats };
  }
  newGame(cfg);
}

// ─────────────────────────────────────────────────────────────
// STATS MODAL
// ─────────────────────────────────────────────────────────────
function renderStatsModal() {
  const body = $('#stats-body');
  const d = loadCareer();
  const names = Object.keys(d);
  if (!names.length) {
    body.innerHTML = '<p class="stats-empty">NO GAMES YET — GO MAKE SOME CHAOS ⚡</p>';
    return;
  }
  names.sort((x, y) => (d[y].wins - d[x].wins) || (d[y].battlesWon - d[x].battlesWon) || x.localeCompare(y));
  body.innerHTML = `
    <table class="stats-table">
      <thead><tr><th>PLAYER</th><th>W</th><th>L</th><th>STREAK</th><th>BEST</th><th>⚔ WON</th></tr></thead>
      <tbody>
        ${names.map((n) => {
          const e = d[n];
          return `<tr><td>${esc(n)}</td><td>${e.wins}</td><td>${e.losses}</td>
            <td>${e.currentStreak}</td><td>${e.bestStreak}</td><td>${e.battlesWon}</td></tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ─────────────────────────────────────────────────────────────
// NAVIGATION & WIRING
// ─────────────────────────────────────────────────────────────
function showScreen(name) {
  ['menu', 'setup', 'game'].forEach((s) => {
    $(`#screen-${s}`).classList.toggle('hidden', s !== name);
  });
}

function hideAllOverlays() {
  $$('.overlay').forEach((o) => o.classList.add('hidden'));
  hideChaosBanner();
}

function toggleSound() {
  SFX.muted = !SFX.muted;
  try { localStorage.setItem(SOUND_KEY, SFX.muted ? '0' : '1'); } catch { /* ignore */ }
  updateSoundIcons();
  if (!SFX.muted) SFX.click();
}
function updateSoundIcons() {
  $$('.sound-btn').forEach((b) => { b.textContent = SFX.muted ? '🔇' : '🔊'; });
}

function quitToMenu() {
  if (battleCtl) battleCtl.abort();
  hideAllOverlays();
  if (S) S.over = true;
  G++;
  S = null;
  showScreen('menu');
}

function init() {
  // sound preference
  try { SFX.muted = localStorage.getItem(SOUND_KEY) === '0'; } catch { /* ignore */ }
  updateSoundIcons();
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

  // menu
  $('#btn-vsai').onclick = () => { SFX.click(); openSetup('cpu'); };
  $('#btn-pvp').onclick = () => { SFX.click(); openSetup('pvp'); };
  $('#btn-rules-menu').onclick = () => { SFX.click(); $('#rules-modal').classList.remove('hidden'); };
  $('#btn-stats-menu').onclick = () => { SFX.click(); renderStatsModal(); $('#stats-modal').classList.remove('hidden'); };

  // setup (delegated)
  const setupBody = $('#setup-body');
  setupBody.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.diff) {
      SFX.click();
      setup.difficulty = t.dataset.diff;
      renderSetup();
    } else if (t.dataset.count) {
      SFX.click();
      const n = +t.dataset.count;
      while (setup.seats.length < n) setup.seats.push(mkSeat(setup.seats.length + 1));
      while (setup.seats.length > n) setup.seats.pop();
      setup.count = n;
      renderSetup();
    } else if (t.dataset.seat !== undefined && t.dataset.kind) {
      SFX.click();
      setup.seats[+t.dataset.seat].isAI = t.dataset.kind === 'ai';
      renderSetup();
    } else if (t.id === 'setup-back') {
      SFX.click();
      showScreen('menu');
    } else if (t.id === 'setup-start') {
      setupStart();
    }
  });
  setupBody.addEventListener('input', (e) => {
    if (e.target.id === 'setup-name') setup.name = e.target.value;
    if (e.target.classList.contains('seat-name-input')) {
      setup.seats[+e.target.dataset.seat].name = e.target.value;
    }
  });

  // game header
  $('#btn-rules-game').onclick = () => { SFX.click(); $('#rules-modal').classList.remove('hidden'); };
  $('#btn-stats-game').onclick = () => { SFX.click(); renderStatsModal(); $('#stats-modal').classList.remove('hidden'); };
  $('#btn-quit').onclick = () => { SFX.click(); $('#quit-modal').classList.remove('hidden'); };
  $('#quit-yes').onclick = () => { SFX.click(); quitToMenu(); };
  $('#quit-no').onclick = () => { SFX.click(); $('#quit-modal').classList.add('hidden'); };

  // draw actions
  $('#draw-pile').addEventListener('click', () => humanDraw());
  $('#draw-pile').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); humanDraw(); }
  });
  $('#btn-draw').addEventListener('click', () => humanDraw());

  // hand (delegated)
  $('#hand').addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-id]');
    if (card) humanPlay(card.dataset.id);
  });
  $('#hand').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.card[data-id]');
    if (card) { e.preventDefault(); humanPlay(card.dataset.id); }
  });

  // game over
  $('#btn-rematch').onclick = () => {
    SFX.click();
    hideAllOverlays();
    if (S && S.cfg) newGame(S.cfg);
    else quitToMenu();
  };
  $('#btn-gomenu').onclick = () => { SFX.click(); quitToMenu(); };

  // modals
  $$('.modal-close').forEach((b) => {
    b.onclick = () => { SFX.click(); $(`#${b.dataset.close}`).classList.add('hidden'); };
  });
  const resetBtn = $('#stats-reset');
  resetBtn.onclick = () => {
    if (resetBtn.dataset.armed) {
      try { localStorage.removeItem(STATS_KEY); } catch { /* ignore */ }
      delete resetBtn.dataset.armed;
      resetBtn.textContent = 'RESET STATS';
      renderStatsModal();
      SFX.penalty();
    } else {
      resetBtn.dataset.armed = '1';
      resetBtn.textContent = 'SURE? TAP AGAIN';
      SFX.click();
      setTimeout(() => { delete resetBtn.dataset.armed; resetBtn.textContent = 'RESET STATS'; }, 2600);
    }
  };

  // sound toggles
  $$('.sound-btn').forEach((b) => { b.onclick = toggleSound; });

  // global keyboard
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (battleCtl) {
      const k = e.key.toLowerCase();
      if (LEFT_KEYS.has(k) || RIGHT_KEYS.has(k)) {
        e.preventDefault();
        if (battleCtl.phase !== 'mash') return;
        battleCtl.tap(LEFT_KEYS.has(k) ? 0 : 1);
      }
      return;
    }
    if (e.key === 'Escape') {
      ['rules-modal', 'stats-modal', 'quit-modal'].forEach((id) => $(`#${id}`).classList.add('hidden'));
    }
  });

  // tiny debug hook (harmless in production)
  window.__UF = {
    get state() { return S; },
    forceChaos() { if (S && !S.over) triggerChaos(G); },
  };
}

init();
})();
