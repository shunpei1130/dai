const SUITS = ['spade', 'heart', 'diamond', 'club'];
const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export function createDeck(ruleConfig, rng = Math.random) {
  let counter = 0;
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit}-${rank}-${counter}`, suit, rank });
      counter += 1;
    }
  }

  for (let i = 0; i < (ruleConfig?.joker?.count ?? 0); i += 1) {
    deck.push({ id: `joker-16-${counter}`, suit: 'joker', rank: 16 });
    counter += 1;
  }

  return deck;
}

export function encodeDeckToIds(deck) {
  return deck.map((card) => card.id);
}

export function getCardFromId(cardId) {
  const [suit, rank] = cardId.split('-');
  return {
    id: cardId,
    suit,
    rank: Number(rank),
  };
}

export function isJoker(card) {
  return card.suit === 'joker';
}

export const CARD_CONSTANTS = {
  SUITS,
  RANKS,
};
