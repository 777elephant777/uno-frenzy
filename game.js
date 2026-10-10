// --- Game State Variables ---
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'SKIP', 'REVERSE', '+2', 'MEGA +4', 'SWAP', 'BATTLE', 'WILDFIRE', 'SHIELD'];
let deck = [];
let discardPile = [];
let playerHand = [];
let botHand = [];
let currentTurn = 'player'; // 'player' | 'bot'
let chaosMeter = 0;
let playerHasShield = false;
let botHasShield = false;
let soundEnabled = true;

// Persistent Stats
let stats = JSON.parse(localStorage.getItem('uno_frenzy_stats')) || { wins: 0, losses: 0, streak: 0, battlesWon: 0 };

// DOM Elements
const drawPileEl = document.getElementById('draw-pile');
const discardPileEl = document.getElementById('discard-pile');
const topCardValueEl = document.getElementById('top-card-value');
const playerHandEl = document.getElementById('player-hand');
const botHandEl = document.getElementById('bot-hand');
const drawCountEl = document.getElementById('draw-count');
const botCardCountEl = document.getElementById('bot-card-count');
const turnIndicatorEl = document.getElementById('turn-indicator');
const chaosBarEl = document.getElementById('chaos-bar');
const actionLogEl = document.getElementById('action-log');
const eventBannerEl = document.getElementById('event-banner');
const eventTextEl = document.getElementById('event-text');
const battleModalEl = document.getElementById('battle-modal');
const clashBtn = document.getElementById('clash-btn');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const rulesBtn = document.getElementById('rules-btn');
const statsBtn = document.getElementById('stats-btn');
const rulesModal = document.getElementById('rules-modal');
const statsModal = document.getElementById('stats-modal');
const closeRulesBtn = document.getElementById('close-rules-btn');
const closeStatsBtn = document.getElementById('close-stats-btn');
const aiDifficultySelect = document.getElementById('ai-difficulty');
const gameContainer = document.getElementById('game-container');

// --- Web Audio API Synth Sound Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (!soundEnabled) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  let now = audioCtx.currentTime;
  if (type === 'play') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'draw') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(400, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'chaos') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.4);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'win') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    osc.frequency.setValueAtTime(800, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

// --- Initialize Game Engine ---
function initGame() {
  deck = createYellowDeck();
  shuffle(deck);
  
  playerHand = deck.splice(0, 7);
  botHand = deck.splice(0, 7);
  discardPile.push(deck.pop());
  
  playerHasShield = false;
  botHasShield = false;
  chaosMeter = 0;
  
  updateUI();
  logAction("Game started! All cards are yellow. Prepare for maximum chaos.");
}

function createYellowDeck() {
  let newDeck = [];
  VALUES.forEach(val => {
    let count = (val === 'MEGA +4' || val === 'WILDFIRE' || val === 'SHIELD') ? 2 : 3;
    for (let i = 0; i < count; i++) {
      newDeck.push({ type: 'yellow', value: val });
    }
  });
  return newDeck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// --- Main Play Logic ---
function playCard(player, index) {
  const hand = player === 'player' ? playerHand : botHand;
  const playedCard = hand[index];
  const topCard = discardPile[discardPile.length - 1];

  if (playedCard.value === topCard.value || isActionCard(playedCard.value) || topCard.value === 'SWAP') {
    hand.splice(index, 1);
    discardPile.push(playedCard);
    playSound('play');
    
    logAction(`${player === 'player' ? 'You' : 'AI'} played [Yellow ${playedCard.value}]`);
    increaseChaos(12);
    handleCardEffects(playedCard.value, player);
  } else {
    if (player === 'player') logAction("⚠️ Invalid move! Match value or play an action card.");
  }
}

function isActionCard(val) {
  return ['SKIP', 'REVERSE', '+2', 'MEGA +4', 'SWAP', 'BATTLE', 'WILDFIRE', 'SHIELD'].includes(val);
}

// --- Card Effects ---
function handleCardEffects(value, player) {
  const opponent = player === 'player' ? 'bot' : 'player';

  switch (value) {
    case 'SKIP':
    case 'REVERSE':
      logAction(`${player === 'player' ? 'AI' : 'Your'} turn was skipped!`);
      break; // Keep turn with same player
      
    case '+2':
      applyPenalty(opponent, 2);
      switchTurn();
      break;

    case 'MEGA +4':
      applyPenalty(opponent, 4);
      switchTurn();
      break;
      
    case 'SWAP':
      logAction("🌀 SWAP! Hands have been completely exchanged!");
      const temp = [...playerHand];
      playerHand = [...botHand];
      botHand = temp;
      switchTurn();
      break;
      
    case 'WILDFIRE':
      logAction("🔥 WILDFIRE! Everyone draws 1 card!");
      drawCards('player', 1);
      drawCards('bot', 1);
      switchTurn();
      break;

    case 'SHIELD':
      if (player === 'player') {
        playerHasShield = true;
        logAction("🛡️ You activated a Shield! Protected from next penalty.");
      } else {
        botHasShield = true;
        logAction("🛡️ AI activated a Shield!");
      }
      switchTurn();
      break;
      
    case 'BATTLE':
      triggerBattleModal();
      break;
      
    default:
      switchTurn();
      break;
  }
  
  checkWinConditions();
  updateUI();
}

function applyPenalty(targetPlayer, count) {
  if (targetPlayer === 'player' && playerHasShield) {
    playerHasShield = false;
    logAction("🛡️ Your Shield blocked the penalty attack!");
    return;
  }
  if (targetPlayer === 'bot' && botHasShield) {
    botHasShield = false;
    logAction("🛡️ AI's Shield blocked the penalty attack!");
    return;
  }
  logAction(`${targetPlayer === 'player' ? 'You' : 'AI'} drew ${count} penalty cards!`);
  drawCards(targetPlayer, count);
}

// --- Draw Mechanics ---
function drawCards(player, count = 1) {
  const hand = player === 'player' ? playerHand : botHand;
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) recycleDiscard();
    if (deck.length > 0) hand.push(deck.pop());
  }
  playSound('draw');
  updateUI();
}

function recycleDiscard() {
  if (discardPile.length <= 1) return;
  const top = discardPile.pop();
  deck = [...discardPile];
  discardPile = [top];
  shuffle(deck);
  logAction("🔄 Reshuffled discard pile into draw deck.");
}

// --- Turn Control ---
function switchTurn() {
  currentTurn = currentTurn === 'player' ? 'bot' : 'player';
  updateUI();

  if (currentTurn === 'bot') {
    let delay = aiDifficultySelect.value === 'insane' ? 700 : 1100;
    setTimeout(botAI, delay);
  }
}

// --- AI Strategy Engine ---
function botAI() {
  if (currentTurn !== 'bot') return;

  const topCard = discardPile[discardPile.length - 1];
  const difficulty = aiDifficultySelect.value;
  
  let playableCards = botHand
    .map((card, index) => ({ card, index }))
    .filter(item => item.card.value === topCard.value || isActionCard(item.card.value));

  let chosenIndex = -1;
  if (playableCards.length > 0) {
    if (difficulty === 'easy') {
      chosenIndex = playableCards[Math.floor(Math.random() * playableCards.length)].index;
    } else {
      // Chaotic / Insane: Prefer action cards if player has low cards
      let actionMatch = playableCards.find(item => isActionCard(item.card.value) && playerHand.length <= 3);
      chosenIndex = actionMatch ? actionMatch.index : playableCards[0].index;
    }
  }

  if (chosenIndex !== -1) {
    playCard('bot', chosenIndex);
  } else {
    logAction("AI has no valid move and draws a card.");
    drawCards('bot', 1);
    switchTurn();
  }
}

// --- Chaos Frenzy Meter & Events ---
function increaseChaos(amount) {
  chaosMeter += amount;
  if (chaosMeter >= 100) {
    chaosMeter = 0;
    triggerRandomChaosEvent();
  }
}

function triggerRandomChaosEvent() {
  playSound('chaos');
  gameContainer.classList.add('shake');
  setTimeout(() => gameContainer.classList.remove('shake'), 400);

  const events = [
    "⚡ YELLOW OUTBURST: Everyone draws 2 cards!",
    "🌪️ REVERSE CHAOS: Deck auto-shuffles!",
    "💥 FRENZY DROP: Top card morphs into a random value!"
  ];
  const chosenEvent = events[Math.floor(Math.random() * events.length)];
  
  eventTextEl.textContent = chosenEvent;
  eventBannerEl.classList.remove('hidden');
  logAction(`🔥 ${chosenEvent}`);

  if (chosenEvent.includes("Everyone draws")) {
    drawCards('player', 2);
    drawCards('bot', 2);
  } else if (chosenEvent.includes("morphs")) {
    const randomVal = VALUES[Math.floor(Math.random() * VALUES.length)];
    discardPile[discardPile.length - 1].value = randomVal;
  }

  setTimeout(() => {
    eventBannerEl.classList.add('hidden');
    updateUI();
  }, 3000);
}

// --- Battle Mini-Game ---
function triggerBattleModal() {
  battleModalEl.classList.remove('hidden');
  let playerScore = 0;
  let botScore = 0;
  let timeLeft = 3;

  const pScoreEl = document.getElementById('player-battle-score');
  const bScoreEl = document.getElementById('bot-battle-score');
  const timerEl = document.getElementById('battle-timer');

  clashBtn.onclick = () => {
    playerScore++;
    pScoreEl.textContent = `You: ${playerScore}`;
  };

  const difficulty = aiDifficultySelect.value;
  const botMultiplier = difficulty === 'insane' ? 2.5 : difficulty === 'chaotic' ? 1.8 : 1.2;

  const interval = setInterval(() => {
    botScore += Math.floor(Math.random() * botMultiplier) + 1;
    bScoreEl.textContent = `AI: ${botScore}`;
    
    timeLeft--;
    timerEl.textContent = `Time Left: ${timeLeft}s`;

    if (timeLeft <= 0) {
      clearInterval(interval);
      battleModalEl.classList.add('hidden');
      
      if (playerScore >= botScore) {
        stats.battlesWon++;
        saveStats();
        logAction(`⚔️ You WON the Card Battle (${playerScore} vs ${botScore})! AI draws 4 cards.`);
        drawCards('bot', 4);
      } else {
        logAction(`⚔️ AI WON the Card Battle (${botScore} vs ${playerScore})! You draw 4 cards.`);
        drawCards('player', 4);
      }
      switchTurn();
    }
  }, 1000);
}

// --- UI & Rendering ---
function updateUI() {
  drawCountEl.textContent = deck.length;
  botCardCountEl.textContent = botHand.length;
  
  if (discardPile.length > 0) {
    topCardValueEl.textContent = discardPile[discardPile.length - 1].value;
  }

  playerHandEl.innerHTML = '';
  playerHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card yellow-card';
    cardEl.innerHTML = `<span>${card.value}</span>`;
    cardEl.onclick = () => {
      if (currentTurn === 'player') playCard('player', index);
    };
    playerHandEl.appendChild(cardEl);
  });

  botHandEl.innerHTML = '';
  botHand.forEach(() => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card back-card';
    cardEl.innerHTML = `<span>?</span>`;
    botHandEl.appendChild(cardEl);
  });

  let turnText = currentTurn === 'player' ? 'Player 1 (You)' : 'AI Opponent';
  if (playerHasShield) turnText += ' 🛡️ [Shielded]';
  turnIndicatorEl.innerHTML = `Current Turn: <strong>${turnText}</strong>`;
  chaosBarEl.style.width = `${chaosMeter}%`;
}

function logAction(msg) {
  const p = document.createElement('p');
  p.textContent = `> ${msg}`;
  actionLogEl.appendChild(p);
  actionLogEl.scrollTop = actionLogEl.scrollHeight;
}

// --- Win Conditions & Stats ---
function checkWinConditions() {
  if (playerHand.length === 0) {
    playSound('win');
    stats.wins++;
    stats.streak++;
    saveStats();
    alert("🎉 VICTORY! You mastered the Uno Frenzy chaos!");
    initGame();
  } else if (botHand.length === 0) {
    stats.losses++;
    stats.streak = 0;
    saveStats();
    alert("🤖 DEFEAT! The AI conquered the yellow chaos.");
    initGame();
  }
}

function saveStats() {
  localStorage.setItem('uno_frenzy_stats', JSON.stringify(stats));
}

// --- Event Listeners ---
drawPileEl.addEventListener('click', () => {
  if (currentTurn === 'player') {
    drawCards('player', 1);
    logAction("You drew a card from the deck.");
    switchTurn();
  }
});

soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggleBtn.textContent = soundEnabled ? "🔊 Sound: ON" : "🔇 Sound: OFF";
});

rulesBtn.addEventListener('click', () => rulesModal.classList.remove('hidden'));
closeRulesBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));

statsBtn.addEventListener('click', () => {
  document.getElementById('stat-wins').textContent = stats.wins;
  document.getElementById('stat-losses').textContent = stats.losses;
  document.getElementById('stat-streak').textContent = stats.streak;
  document.getElementById('stat-battles').textContent = stats.battlesWon;
  statsModal.classList.remove('hidden');
});
closeStatsBtn.addEventListener('click', () => statsModal.classList.add('hidden'));

window.onload = initGame;
