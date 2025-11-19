import { CARD_CONSTANTS } from './cards.js';

function getBaseOrder() {
  return [...CARD_CONSTANTS.RANKS];
}

export function getRankOrder(state) {
  const base = getBaseOrder();
  const includeJoker = state?.ruleConfig?.joker?.behavior === 'strongest';
  const ordered = includeJoker ? [...base, 16] : base;
  if (state?.isRevolution) {
    return [...ordered].reverse();
  }
  return ordered;
}

export function compareRank(state, a, b) {
  const order = getRankOrder(state);
  return order.indexOf(a) - order.indexOf(b);
}

export function sortRanks(ranks) {
  return [...ranks].sort((a, b) => a - b);
}
