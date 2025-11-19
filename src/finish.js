import { appendLog } from './log.js';
import { getAlivePlayers } from './turn.js';

function containsRank(pattern, rank) {
  return pattern?.ranks?.includes(rank);
}

function checkForbidFinish(state, pattern) {
  const rule = state.ruleConfig?.backAndBan ?? {};
  if (rule.forbidLast2or3 && (containsRank(pattern, 15) || containsRank(pattern, 3))) {
    return 'forbidLast2or3';
  }
  if (rule.forbid8 && containsRank(pattern, 8)) {
    return 'forbid8';
  }
  if (rule.forbid11Back && containsRank(pattern, 11)) {
    return 'forbid11Back';
  }
  if (rule.forbidJoker && containsRank(pattern, 16)) {
    return 'forbidJoker';
  }
  if (rule.forbidSpade3) {
    const hasSpade3 = pattern?.cards?.some((card) => card.suit === 'spade' && card.rank === 3);
    if (hasSpade3) return 'forbidSpade3';
  }
  return null;
}

function applyFinishViolation(state, playerId, violation) {
  return appendLog(state, {
    type: 'ruleTriggered',
    message: `上がり禁止違反(${violation})により${playerId}の上がりは無効です`,
    payload: { playerId, violation },
  });
}

function finalizeRoundIfNeeded(state) {
  if (state.finishedOrder.length === state.players.length) {
    return {
      ...state,
      phase: 'roundEnd',
      currentTurnPlayerId: null,
    };
  }
  return state;
}

export function registerFinish(state, playerId) {
  if (state.finishedOrder.includes(playerId)) return state;
  let nextState = {
    ...state,
    finishedOrder: [...state.finishedOrder, playerId],
  };
  nextState = appendLog(nextState, {
    type: 'playerFinished',
    message: `${playerId}が上がりました`,
    payload: { playerId, order: nextState.finishedOrder.length },
  });

  if (getAlivePlayers(nextState).length === 0) {
    nextState = finalizeRoundIfNeeded(nextState);
  }

  return nextState;
}

export function checkFinish(state, playerId, pattern) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  if (player.hand.length > 0) return state;
  const violation = checkForbidFinish(state, pattern);
  if (violation) {
    return applyFinishViolation(state, playerId, violation);
  }
  return registerFinish(state, playerId);
}
