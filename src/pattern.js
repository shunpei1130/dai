import { getCardFromId, isJoker } from './cards.js';
import { compareRank, sortRanks } from './rank.js';

function createPatternBase(cardIds) {
  const cards = cardIds.map(getCardFromId);
  return {
    cardIds: [...cardIds],
    cards,
    suits: cards.map((card) => card.suit),
    ranks: cards.map((card) => card.rank),
  };
}

function isConsecutive(ranks) {
  const ordered = sortRanks(ranks);
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i] - ordered[i - 1] !== 1) {
      return false;
    }
  }
  return true;
}

function createSpecialTags(pattern) {
  const tags = [];
  const rankSet = new Set(pattern.ranks);
  if (rankSet.has(8)) tags.push('cut8');
  if (rankSet.has(4)) tags.push('stop4');
  if (rankSet.has(9)) tags.push('reverse9');
  if (rankSet.has(12)) tags.push('reverse12');
  if (rankSet.has(5)) tags.push('skip5');
  if (rankSet.has(13)) tags.push('skip13');
  if (rankSet.has(11)) tags.push('back11');
  if (rankSet.has(16)) tags.push('joker');
  return tags;
}

export function detectPattern(cardIds, state) {
  if (!cardIds || cardIds.length === 0) {
    return new Error('カードが選ばれていません');
  }

  const base = createPatternBase(cardIds);
  const uniqueRanks = [...new Set(base.ranks)];
  const uniqueSuits = [...new Set(base.suits.filter((suit) => suit !== 'joker'))];
  let type = null;
  let mainRank = base.ranks[0];
  let length = cardIds.length;
  let isRevolutionTrigger = false;

  if (uniqueRanks.length === 1 && !base.suits.includes('joker')) {
    switch (cardIds.length) {
      case 1:
        type = 'single';
        break;
      case 2:
        type = 'pair';
        break;
      case 3:
        type = 'triple';
        break;
      case 4:
        type = 'quad';
        isRevolutionTrigger = state.ruleConfig?.revolution?.normal ?? false;
        break;
      default:
        return new Error('同じ数字のカードは4枚までです');
    }
  }

  const stairRule = state.ruleConfig?.stair ?? { enabled: false };
  if (!type && stairRule.enabled) {
    const cardsWithoutJoker = base.cards.filter((card) => !isJoker(card));
    if (
      cardsWithoutJoker.length === cardIds.length &&
      uniqueSuits.length === 1 &&
      cardIds.length >= stairRule.minLength &&
      cardIds.length <= (stairRule.maxLength ?? Infinity) &&
      isConsecutive(base.ranks)
    ) {
      type = 'stair';
      length = cardIds.length;
      mainRank = stairRule.strengthBasis === 'lowest' ? Math.min(...base.ranks) : Math.max(...base.ranks);
      if ((state.ruleConfig?.revolution?.stair ?? false) && length >= (state.ruleConfig?.revolution?.stairMinLength ?? 3)) {
        isRevolutionTrigger = true;
      }
    }
  }

  if (!type) {
    return new Error('不正なカードの組み合わせです');
  }

  const pattern = {
    type,
    mainRank,
    length,
    isRevolutionTrigger,
    isSpecial: createSpecialTags(base),
    ...base,
  };

  return pattern;
}

export function isStronger(state, pattern, prevPattern) {
  if (pattern.type !== prevPattern.type) return false;
  if (pattern.length !== prevPattern.length) return false;
  return compareRank(state, pattern.mainRank, prevPattern.mainRank) > 0;
}

export function ownsAllCards(state, playerId, cardIds) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  const hand = [...player.hand];
  for (const cardId of cardIds) {
    const index = hand.indexOf(cardId);
    if (index === -1) return false;
    hand.splice(index, 1);
  }
  return true;
}
