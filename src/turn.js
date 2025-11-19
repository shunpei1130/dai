import { appendLog } from './log.js';

export function getAlivePlayers(state) {
  return state.players.filter((player) => !state.finishedOrder.includes(player.id));
}

export function shouldClearTrick(state) {
  if (!state.currentTrick) return false;
  const aliveIds = getAlivePlayers(state).map((player) => player.id);
  const others = aliveIds.filter((id) => id !== state.currentTrick.ownerId);
  if (others.length === 0) return false;
  return others.every((id) => state.passedPlayerIds.includes(id));
}

export function clearTrick(state, reason = 'trickCleared', options = {}) {
  if (!state.currentTrick) return state;
  let nextState = {
    ...state,
    discardPile: [...state.discardPile, state.currentTrick.cards],
    currentTrick: null,
    passedPlayerIds: [],
  };
  nextState = appendLog(nextState, {
    type: 'trickCleared',
    message: options.message ?? '場が流れました',
    payload: { reason },
  });
  if (options.keepTurnWith) {
    nextState = { ...nextState, nextTurnOverride: options.keepTurnWith };
  }
  return nextState;
}

export function getEffectiveDirection(state) {
  const back11Modifier = state.isBack11 ? -1 : 1;
  return state.turnDirection * back11Modifier;
}

export function determineNextTurn(state) {
  if (state.phase !== 'playing') return state;
  let workingState = state;

  if (getAlivePlayers(workingState).length === 0) {
    return workingState;
  }

  if (workingState.nextTurnOverride) {
    const nextId = workingState.nextTurnOverride;
    workingState = { ...workingState, nextTurnOverride: null, currentTurnPlayerId: nextId };
    return workingState;
  }

  const direction = getEffectiveDirection(workingState);
  const currentPlayer = workingState.players.find((p) => p.id === workingState.currentTurnPlayerId) ?? getAlivePlayers(workingState)[0];
  let seatIndex = currentPlayer?.seatIndex ?? 0;
  const limit = workingState.players.length * 2;
  let steps = 0;

  while (steps < limit) {
    seatIndex = (seatIndex + direction + workingState.players.length) % workingState.players.length;
    const candidate = workingState.players.find((p) => p.seatIndex === seatIndex);
    steps += 1;
    if (!candidate) continue;
    if (workingState.finishedOrder.includes(candidate.id)) continue;

    if (shouldClearTrick(workingState)) {
      workingState = clearTrick(workingState, 'auto');
    }

    if (workingState.pendingSkips > 0) {
      workingState = { ...workingState, pendingSkips: workingState.pendingSkips - 1 };
      continue;
    }

    return {
      ...workingState,
      currentTurnPlayerId: candidate.id,
    };
  }

  return workingState;
}
