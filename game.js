// --- Game State Variables ---
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'SKIP', 'REVERSE', '+2', 'SWAP', 'BATTLE'];
let deck = [];
let discardPile = [];
let playerHand = [];
let botHand = [];
let currentTurn = 'player'; // 'player' | 'bot'
let chaosMeter = 0;

// Dynamic DOM Elements
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

// Initialize Game Engine
function initGame() {
  deck = createYellowDeck();
  shuffle(deck);
  
  // Deal Initial Cards (7 cards each)
  playerHand = deck.splice(0, 7);
  botHand = deck.splice(0, 7);
  
  // Set Initial Discard Card
  discardPile.push(deck.pop());
  
  updateUI();
  logAction("Game started! All cards are yellow. Prepare for dynamic chaos.");
}

// Generate Custom Yellow Deck
function createYellowDeck() {
  let newDeck = [];
  VALUES.forEach(val => {
    // 4 copies of each yellow card type
    for (let i = 0; i < 4; i++) {
      newDeck.push({ type: 'yellow', value: val });
    }
  });
  return newDeck;
}

// Shuffle Helper
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Main Play Logic
function playCard(player, index) {
  const hand = player === 'player' ? playerHand : botHand;
  const playedCard = hand[index];
  const topCard = discardPile[discardPile.length - 1];

  // Validation: Matching value or playing action cards
  if (playedCard.value === topCard.value || isActionCard(playedCard.value) || topCard.value === 'SWAP') {
    hand.splice(index, 1);
    discardPile.push(playedCard);
    
    logAction(`${player === 'player' ? 'You' : 'AI'} played [Yellow ${playedCard.value}]`);
    
    // Add to Chaos Meter
    increaseChaos(15);
    
    // Execute Card Special Mechanics
    handleCardEffects(playedCard.value, player);
  } else {
    if (player === 'player') logAction("⚠️ Invalid move! Match value or play an action card.");
  }
}

function isActionCard(val) {
  return ['SKIP', 'REVERSE', '+2', 'SWAP', 'BATTLE'].includes(val);
}

// Special Effect Logic
function handleCardEffects(value, player) {
  const opponent = player === 'player' ? 'bot' : 'player';
  const opponentHand = opponent === 'player' ? playerHand : botHand;

  switch (value) {
    case 'SKIP':
    case 'REVERSE':
      logAction(`${player === 'player' ? 'AI' : 'Your'} turn was skipped!`);
      break; // Turn stays with current player
      
    case '+2':
      logAction(`${opponent === 'player' ? 'You' : 'AI'} drew 2 cards!`);
      drawCards(opponent, 2);
      switchTurn();
      break;
      
    case 'SWAP':
      logAction("🌀 SWAP! Hands have been exchanged!");
      const temp = [...playerHand];
      playerHand = [...botHand];
      botHand = temp;
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

// Draw Mechanics
function drawCards(player, count = 1) {
  const hand = player === 'player' ? playerHand : botHand;
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) recycleDiscard();
    if (deck.length > 0) hand.push(deck.pop());
  }
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

// Turn Controller
function switchTurn() {
  currentTurn = currentTurn === 'player' ? 'bot' : 'player';
  updateUI();

  if (currentTurn === 'bot') {
    setTimeout(botAI, 1200);
  }
}

// AI Opponent Strategy
function botAI() {
  if (currentTurn !== 'bot') return;

  const topCard = discardPile[discardPile.length - 1];
  let playableIndex = botHand.findIndex(card => 
    card.value === topCard.value || isActionCard(card.value)
  );

  if (playableIndex !== -1) {
    playCard('bot', playableIndex);
  } else {
    logAction("AI has no valid move and draws a card.");
    drawCards('bot', 1);
    switchTurn();
  }
}

// Chaos Meter Mechanics
function increaseChaos(amount) {
  chaosMeter += amount;
  if (chaosMeter >= 100) {
    chaosMeter = 0;
    triggerRandomChaosEvent();
  }
}

function triggerRandomChaosEvent() {
  const events = [
    "⚡ YELLOW OUTBURST: Everyone draws 2 cards!",
    "🌪️ REVERSE CHAOS: Deck auto-shuffles!",
    "💥 FRENZY DROP: Top card randomly morphs!"
  ];
  const chosenEvent = events[Math.floor(Math.random() * events.length)];
  
  eventTextEl.textContent = chosenEvent;
  eventBannerEl.classList.remove('hidden');
  logAction(`🔥 ${chosenEvent}`);

  // Apply Chaos Event Effects
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

// Sudden Card Battle Mini-Game
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

  const interval = setInterval(() => {
    // Bot auto taps randomly
    botScore += Math.floor(Math.random() * 3);
    bScoreEl.textContent = `AI: ${botScore}`;
    
    timeLeft--;
    timerEl.textContent = `Time Left: ${timeLeft}s`;

    if (timeLeft <= 0) {
      clearInterval(interval);
      battleModalEl.classList.add('hidden');
      
      if (playerScore >= botScore) {
        logAction(`⚔️ You WON the Card Battle (${playerScore} vs ${botScore})! AI draws 3 cards.`);
        drawCards('bot', 3);
      } else {
        logAction(`⚔️ AI WON the Card Battle (${botScore} vs ${playerScore})! You draw 3 cards.`);
        drawCards('player', 3);
      }
      switchTurn();
    }
  }, 1000);
}

// Render Logic
function updateUI() {
  // Update Cards Count
  drawCountEl.textContent = deck.length;
  botCardCountEl.textContent = botHand.length;
  
  // Render Top Discard Card
  if (discardPile.length > 0) {
    topCardValueEl.textContent = discardPile[discardPile.length - 1].value;
  }

  // Render Player Hand
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

  // Render Bot Card Backs
  botHandEl.innerHTML = '';
  botHand.forEach(() => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card back-card';
    cardEl.innerHTML = `<span>?</span>`;
    botHandEl.appendChild(cardEl);
  });

  // Turn status
  turnIndicatorEl.innerHTML = `Current Turn: <strong>${currentTurn === 'player' ? 'Player 1' : 'AI Opponent'}</strong>`;
  chaosBarEl.style.width = `${chaosMeter}%`;
}

// Log System
function logAction(msg) {
  const p = document.createElement('p');
  p.textContent = `> ${msg}`;
  actionLogEl.appendChild(p);
  actionLogEl.scrollTop = actionLogEl.scrollHeight;
}

// Win Check
function checkWinConditions() {
  if (playerHand.length === 0) {
    alert("🎉 Victory! You mastered the Uno Frenzy chaos!");
    initGame();
  } else if (botHand.length === 0) {
    alert("🤖 Defeat! The AI conquered the yellow chaos.");
    initGame();
  }
}

// Event Listeners
drawPileEl.addEventListener('click', () => {
  if (currentTurn === 'player') {
    drawCards('player', 1);
    logAction("You drew a card from the deck.");
    switchTurn();
  }
});

// Start Game On Load
window.onload = initGame;
