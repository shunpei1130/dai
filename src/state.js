import { createDeck, encodeDeckToIds } from './cards.js';
import { appendLog } from './log.js';
import { createDefaultRuleConfig } from './rules/defaultRuleConfig.js';
import { mergeRuleConfig } from './rules/mergeRuleConfig.js';
import { shuffle } from './utils/shuffle.js';

export function createInitialState(id, ruleOverride = {}) {
  const base = createDefaultRuleConfig();
  const ruleConfig = mergeRuleConfig(base, ruleOverride);
  return {
    id,
    phase: 'lobby',
    players: [],
    deck: [],
    discardPile: [],
    currentTrick: null,
    currentTurnPlayerId: null,
    passedPlayerIds: [],
    finishedOrder: [],
    isRevolution: false,
    isBack11: false,
    bindState: { active: false, streak: 0 },
    roundNumber: 1,
    ruleConfig,
    logs: [],
    turnDirection: 1,
    pendingSkips: 0,
    nextTurnOverride: null,
  };
}

export function dealCards(state, rng = Math.random) {
  const deck = shuffle(createDeck(state.ruleConfig), rng);
  const deckIds = encodeDeckToIds(deck);
  const players = state.players.map((player) => ({ ...player, hand: [] }));
  deckIds.forEach((cardId, index) => {
    const playerIndex = index % players.length;
    players[playerIndex].hand = [...players[playerIndex].hand, cardId];
  });
  return {
    ...state,
    deck: [],
    players,
    discardPile: [],
    currentTrick: null,
    passedPlayerIds: [],
  };
}

export function setPhase(state, phase) {
  if (state.phase === phase) return state;
  return appendLog(
    {
      ...state,
      phase,
    },
    {
      type: phase === 'playing' ? 'gameStarted' : 'ruleTriggered',
      message: `フェーズが${state.phase}から${phase}に遷移しました`,
      payload: { from: state.phase, to: phase },
    }
  );
}
