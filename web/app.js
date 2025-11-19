import { createInitialState, reduceGame } from '../src/index.js';
import { getCardFromId } from '../src/cards.js';

const SUIT_ICON = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
  joker: '🃏',
};

const DEMO_NAMES = ['Luna', 'Kai', 'Mika', 'Sora', 'Noa', 'Ren'];

const stateRefs = {
  phase: document.querySelector('[data-phase]'),
  room: document.querySelector('[data-room]'),
  turn: document.querySelector('[data-turn]'),
  round: document.querySelector('[data-round]'),
  revolution: document.querySelector('[data-revolution]'),
  back11: document.querySelector('[data-back11]'),
  trick: document.querySelector('[data-trick]'),
  trickOwner: document.querySelector('[data-trick-owner]'),
  playerList: document.querySelector('[data-player-list]'),
  log: document.querySelector('[data-log]'),
  statusPills: document.querySelector('[data-status-pills]'),
};

const joinForm = document.querySelector('#join-form');
const joinInput = document.querySelector('#player-name');
const playForm = document.querySelector('#play-form');
const playPlayerSelect = document.querySelector('#play-player');
const cardSelect = document.querySelector('#card-select');
const passButton = document.querySelector('button[data-action="pass"]');
const startButton = document.querySelector('button[data-action="start"]');
const nextRoundButton = document.querySelector('button[data-action="next-round"]');
const demoButton = document.querySelector('button[data-action="autofill"]');
const playSubmitButton = playForm.querySelector('button[type="submit"]');
cardSelect.addEventListener('change', () => updateActionStates());

let state = createInitialState('studio-room');
let playerCount = 1;
let selectedPlayPlayerId = '';

function applyCommand(command) {
  state = reduceGame(state, command);
}

function sendCommand(command) {
  applyCommand(command);
  render();
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = joinInput.value.trim();
  if (!name) return;
  const playerId = `user-${playerCount}`;
  playerCount += 1;
  sendCommand({ type: 'join', playerId, name });
  joinInput.value = '';
});

demoButton.addEventListener('click', () => {
  const name = DEMO_NAMES[(playerCount - 1) % DEMO_NAMES.length];
  const playerId = `demo-${playerCount}`;
  playerCount += 1;
  applyCommand({ type: 'join', playerId, name });
  applyCommand({ type: 'ready', playerId });
  render();
});

stateRefs.playerList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="ready-player"]');
  if (!button) return;
  const playerId = button.dataset.player;
  sendCommand({ type: 'ready', playerId });
});

startButton.addEventListener('click', () => {
  const hostId = state.players[0]?.id;
  if (!hostId) return;
  sendCommand({ type: 'startGame', playerId: hostId });
});

nextRoundButton.addEventListener('click', () => {
  const hostId = state.players[0]?.id;
  if (!hostId) return;
  sendCommand({ type: 'nextRound', playerId: hostId });
});

playPlayerSelect.addEventListener('change', () => {
  selectedPlayPlayerId = playPlayerSelect.value;
  renderCardOptions();
  updateActionStates();
});

playForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const playerId = playPlayerSelect.value;
  const cardIds = Array.from(cardSelect.selectedOptions).map((option) => option.value);
  if (!playerId || cardIds.length === 0) return;
  sendCommand({ type: 'playCards', playerId, cardIds });
});

passButton.addEventListener('click', () => {
  const playerId = playPlayerSelect.value;
  if (!playerId) return;
  sendCommand({ type: 'pass', playerId });
});

function render() {
  renderSummary();
  renderPlayers();
  renderCardOptions();
  renderLogs();
  updateActionStates();
}

function renderSummary() {
  stateRefs.phase.textContent = state.phase;
  stateRefs.room.textContent = `Room: ${state.id}`;
  const currentPlayer = state.players.find((player) => player.id === state.currentTurnPlayerId);
  stateRefs.turn.textContent = currentPlayer ? currentPlayer.name : '—';
  stateRefs.round.textContent = state.roundNumber;
  stateRefs.revolution.textContent = state.isRevolution ? 'ON' : 'OFF';
  stateRefs.back11.textContent = state.isBack11 ? 'ON' : 'OFF';

  if (state.currentTrick && state.currentTrick.cards.length) {
    stateRefs.trick.innerHTML = state.currentTrick.cards.map(renderCardPill).join('');
    const owner = state.players.find((player) => player.id === state.currentTrick.ownerId);
    stateRefs.trickOwner.textContent = owner ? `${owner.name} が場を作成` : '';
  } else {
    stateRefs.trick.innerHTML = '<span class="muted">—</span>';
    stateRefs.trickOwner.textContent = '';
  }

  renderStatusPills();
}

function renderStatusPills() {
  const pills = [];
  if (state.passedPlayerIds.length) {
    pills.push(`パス: ${state.passedPlayerIds.length}人`);
  }
  if (state.bindState?.active) {
    const detail = state.bindState.bySuit ? `${state.bindState.bySuit}` : state.bindState.byRank;
    pills.push(`縛り中 ${detail ?? ''}`.trim());
  }
  if (state.pendingSkips) {
    pills.push(`スキップ: ${state.pendingSkips}`);
  }
  if (state.finishedOrder.length) {
    pills.push(`あがり: ${state.finishedOrder.length}人`);
  }

  stateRefs.statusPills.innerHTML = pills.length
    ? pills.map((text) => `<span class="status-pill">${text}</span>`).join('')
    : '<span class="muted">静かな状態です</span>';
}

function renderPlayers() {
  if (!state.players.length) {
    stateRefs.playerList.innerHTML = '<p class="muted">まだプレイヤーがいません</p>';
    return;
  }
  stateRefs.playerList.innerHTML = state.players
    .map((player) => createPlayerCard(player))
    .join('');
}

function createPlayerCard(player) {
  const isActive = player.id === state.currentTurnPlayerId;
  const readyText = player.isReady ? 'READY' : 'WAITING';
  const readyDisabled = player.isReady || state.phase !== 'lobby';
  const handPreview = formatHandPreview(player.hand);
  return `
    <article class="player-card ${isActive ? 'active' : ''}">
      <div>
        <strong>${player.name}</strong>
        <p class="hand">${handPreview}</p>
      </div>
      <span class="badge">${readyText}</span>
      <button type="button" class="ghost" data-action="ready-player" data-player="${player.id}" ${
        readyDisabled ? 'disabled' : ''
      }>Ready</button>
    </article>
  `;
}

function formatHandPreview(hand) {
  if (!hand.length) return '手札なし';
  const preview = hand
    .slice(0, 4)
    .map((cardId) => formatCardLabel(cardId))
    .join(' ');
  const rest = hand.length > 4 ? ` +${hand.length - 4}` : '';
  return `${hand.length}枚 / ${preview}${rest}`;
}

function renderCardOptions() {
  if (state.phase !== 'playing') {
    selectedPlayPlayerId = '';
  } else if (state.currentTurnPlayerId) {
    selectedPlayPlayerId = state.currentTurnPlayerId;
  }
  const options = state.players
    .map((player) => `<option value="${player.id}" ${
      player.id === selectedPlayPlayerId ? 'selected' : ''
    }>${player.name}</option>`)
    .join('');

  playPlayerSelect.innerHTML = `<option value="">選択してください</option>${options}`;

  if (selectedPlayPlayerId && !state.players.find((p) => p.id === selectedPlayPlayerId)) {
    selectedPlayPlayerId = '';
    playPlayerSelect.value = '';
  }

  if (selectedPlayPlayerId) {
    playPlayerSelect.value = selectedPlayPlayerId;
  }

  const player = state.players.find((p) => p.id === playPlayerSelect.value);
  const cards = player ? [...player.hand] : [];
  cards.sort((a, b) => compareCards(a, b));
  cardSelect.innerHTML = cards
    .map((cardId) => `<option value="${cardId}">${formatCardLabel(cardId)}</option>`)
    .join('');
}

function compareCards(a, b) {
  const cardA = getCardFromId(a);
  const cardB = getCardFromId(b);
  if (cardA.rank === cardB.rank) return cardA.suit.localeCompare(cardB.suit);
  return cardA.rank - cardB.rank;
}

function renderLogs() {
  if (!state.logs.length) {
    stateRefs.log.innerHTML = '<li class="muted">まだログはありません</li>';
    return;
  }
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const entries = [...state.logs].slice(-10).reverse();
  stateRefs.log.innerHTML = entries
    .map(
      (entry) => `
        <li>
          <time>${formatter.format(entry.createdAt)}</time>
          ${entry.message}
        </li>
      `
    )
    .join('');
}

function updateActionStates() {
  const everyoneReady = state.players.length > 0 && state.players.every((player) => player.isReady);
  startButton.disabled = !(state.phase === 'lobby' && everyoneReady);
  nextRoundButton.disabled = state.phase !== 'roundEnd';

  const canPlay = state.phase === 'playing' && state.players.length > 0;
  playPlayerSelect.disabled = !canPlay;
  cardSelect.disabled = !canPlay || !playPlayerSelect.value;
  const hasSelection = cardSelect.selectedOptions.length > 0;
  playSubmitButton.disabled = !(canPlay && hasSelection);
  passButton.disabled = !(canPlay && playPlayerSelect.value);
}

function renderCardPill(cardId) {
  const label = formatCardLabel(cardId);
  const card = getCardFromId(cardId);
  const sub = card.suit === 'joker' ? 'Joker' : card.suit;
  return `<div class="card-pill">${label}<small>${sub}</small></div>`;
}

function formatCardLabel(cardId) {
  const card = getCardFromId(cardId);
  const icon = SUIT_ICON[card.suit] ?? '❖';
  const rankLabel = getRankLabel(card.rank);
  return `${icon} ${rankLabel}`;
}

function getRankLabel(rank) {
  switch (rank) {
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    case 14:
      return 'A';
    case 15:
      return '2';
    case 16:
      return 'Joker';
    default:
      return rank;
  }
}

render();
