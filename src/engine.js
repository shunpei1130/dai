import { appendLog } from './log.js';
import { dealCards, setPhase } from './state.js';
import { detectPattern, isStronger, ownsAllCards } from './pattern.js';
import { satisfiesBind } from './bind.js';
import { applyTriggers } from './rules/applyTriggers.js';
import { checkFinish } from './finish.js';
import { clearTrick, determineNextTurn, shouldClearTrick } from './turn.js';
import { mergeRuleConfig } from './rules/mergeRuleConfig.js';
import { createDefaultRuleConfig } from './rules/defaultRuleConfig.js';

function withPlayers(state, players) {
  return { ...state, players };
}

function updatePlayer(state, playerId, updater) {
  const players = state.players.map((player) =>
    player.id === playerId ? { ...player, ...updater(player) } : player
  );
  return withPlayers(state, players);
}

function applyPlay(state, playerId, cardIds, pattern) {
  const nextPlayers = state.players.map((player) => {
    if (player.id !== playerId) return player;
    const hand = player.hand.filter((cardId) => !cardIds.includes(cardId));
    return { ...player, hand };
  });
  let nextState = {
    ...state,
    players: nextPlayers,
    currentTrick: { cards: [...cardIds], ownerId: playerId, isPassed: false },
    passedPlayerIds: state.passedPlayerIds.filter((id) => id !== playerId),
  };
  nextState = appendLog(nextState, {
    type: 'cardsPlayed',
    message: `${playerId}が${cardIds.length}枚出しました`,
    payload: { playerId, cardIds, pattern },
  });
  return nextState;
}

function canPlay(state, playerId, cardIds) {
  if (!ownsAllCards(state, playerId, cardIds)) {
    return { ok: false, reason: 'カードが手札にありません' };
  }
  const pattern = detectPattern(cardIds, state);
  if (pattern instanceof Error) {
    return { ok: false, reason: pattern.message };
  }
  if (!state.currentTrick) {
    if (!satisfiesBind(state, pattern)) {
      return { ok: false, reason: '縛り条件を満たしていません' };
    }
    return { ok: true, pattern };
  }
  const prevPattern = detectPattern(state.currentTrick.cards, state);
  if (prevPattern instanceof Error) {
    return { ok: false, reason: '場のカードが不正です' };
  }
  if (pattern.type !== prevPattern.type || pattern.length !== prevPattern.length) {
    return { ok: false, reason: '同じ役で出す必要があります' };
  }
  if (!satisfiesBind(state, pattern)) {
    return { ok: false, reason: '縛り条件を満たしていません' };
  }
  if (!isStronger(state, pattern, prevPattern)) {
    return { ok: false, reason: '前のカードより弱いです' };
  }
  return { ok: true, pattern };
}

function determineStarter(state) {
  const startRule = state.ruleConfig.start;
  if (!startRule) {
    return state.players[0]?.id ?? null;
  }
  if (startRule.starter.endsWith('3')) {
    const suit = startRule.starter.replace('3', '');
    const targetPrefix = `${suit}-3`;
    for (const player of state.players) {
      const hasCard = player.hand.some((cardId) => cardId.startsWith(targetPrefix));
      if (hasCard) {
        return player.id;
      }
    }
  }
  return state.players[0]?.id ?? null;
}

function handlePlayCards(state, command) {
  if (state.phase !== 'playing') return state;
  if (state.currentTurnPlayerId !== command.playerId) return state;

  const validation = canPlay(state, command.playerId, command.cardIds);
  if (!validation.ok) {
    return appendLog(state, {
      type: 'ruleTriggered',
      message: validation.reason,
      payload: { playerId: command.playerId, cardIds: command.cardIds },
    });
  }

  let nextState = applyPlay(state, command.playerId, command.cardIds, validation.pattern);
  nextState = applyTriggers(nextState, command.playerId, validation.pattern);
  nextState = checkFinish(nextState, command.playerId, validation.pattern);

  if (nextState.phase === 'roundEnd') {
    return nextState;
  }

  return determineNextTurn(nextState);
}

function handlePass(state, command) {
  if (state.phase !== 'playing') return state;
  if (state.currentTurnPlayerId !== command.playerId) return state;
  if (!state.currentTrick) return state;

  let nextState = {
    ...state,
    passedPlayerIds: state.passedPlayerIds.includes(command.playerId)
      ? state.passedPlayerIds
      : [...state.passedPlayerIds, command.playerId],
  };
  nextState = appendLog(nextState, {
    type: 'pass',
    message: `${command.playerId}がパスしました`,
    payload: { playerId: command.playerId },
  });

  if (shouldClearTrick(nextState)) {
    nextState = clearTrick(nextState, 'passClear', {
      keepTurnWith: nextState.currentTrick?.ownerId,
      message: '全員パスのため場流れ',
    });
  }

  return determineNextTurn(nextState);
}

function handleJoin(state, command) {
  if (state.phase !== 'lobby') return state;
  if (state.players.find((player) => player.id === command.playerId)) {
    return state;
  }
  const player = {
    id: command.playerId,
    name: command.name,
    seatIndex: state.players.length,
    hand: [],
    role: undefined,
    isConnected: true,
    isReady: false,
  };
  return {
    ...state,
    players: [...state.players, player],
  };
}

function handleReady(state, command) {
  if (state.phase !== 'lobby') return state;
  return updatePlayer(state, command.playerId, () => ({ isReady: true }));
}

function handleUpdateRule(state, command) {
  if (state.phase !== 'lobby') return state;
  const merged = mergeRuleConfig(state.ruleConfig, command.rule ?? {});
  return {
    ...state,
    ruleConfig: merged,
  };
}

function handleStartGame(state) {
  if (state.phase !== 'lobby') return state;
  if (state.players.length === 0) return state;
  if (!state.players.every((player) => player.isReady)) {
    return appendLog(state, {
      type: 'ruleTriggered',
      message: '全員の準備完了が必要です',
    });
  }
  let nextState = setPhase(state, 'dealing');
  nextState = dealCards(nextState);
  nextState = setPhase(nextState, 'playing');
  const starterId = determineStarter(nextState);
  nextState = {
    ...nextState,
    currentTurnPlayerId: starterId,
    passedPlayerIds: [],
    finishedOrder: [],
    discardPile: [],
    currentTrick: null,
    pendingSkips: 0,
  };
  nextState = appendLog(nextState, {
    type: 'cardsDealt',
    message: 'カードを配りました',
  });
  return nextState;
}

function handleNextRound(state) {
  if (state.phase !== 'roundEnd') return state;
  let nextState = {
    ...state,
    roundNumber: state.roundNumber + 1,
    finishedOrder: [],
    passedPlayerIds: [],
    currentTrick: null,
    discardPile: [],
    isRevolution: false,
    isBack11: false,
    pendingSkips: 0,
    turnDirection: 1,
  };
  nextState = setPhase(nextState, 'dealing');
  nextState = dealCards(nextState);
  nextState = setPhase(nextState, 'playing');
  return {
    ...nextState,
    currentTurnPlayerId: determineStarter(nextState),
  };
}

function handleSelectCoup(state) {
  return appendLog(state, {
    type: 'ruleTriggered',
    message: '革命選択クーデターは未対応です',
  });
}

export function reduceGame(state, command) {
  switch (command.type) {
    case 'join':
      return handleJoin(state, command);
    case 'ready':
      return handleReady(state, command);
    case 'updateRule':
      return handleUpdateRule(state, command);
    case 'startGame':
      return handleStartGame(state);
    case 'playCards':
      return handlePlayCards(state, command);
    case 'pass':
      return handlePass(state, command);
    case 'selectCoup':
      return handleSelectCoup(state, command);
    case 'nextRound':
      return handleNextRound(state);
    default:
      return state;
  }
}

export function canPlayerPlay(state, playerId, cardIds) {
  return canPlay(state, playerId, cardIds);
}

export function createStateWithPlayers(roomId, players) {
  let state = {
    id: roomId,
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
    ruleConfig: createDefaultRuleConfig(),
    logs: [],
    turnDirection: 1,
    pendingSkips: 0,
    nextTurnOverride: null,
  };
  players.forEach((player) => {
    state = handleJoin(state, { type: 'join', playerId: player.id, name: player.name });
    state = handleReady(state, { type: 'ready', playerId: player.id });
  });
  return state;
}
