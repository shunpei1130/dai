export function satisfiesBind(state, pattern) {
  const bind = state.bindState;
  if (!bind?.active) return true;
  if (bind.byRank && pattern.mainRank !== bind.byRank) {
    return false;
  }
  if (bind.bySuit) {
    return pattern.suits.every((suit) => suit === bind.bySuit);
  }
  return true;
}
