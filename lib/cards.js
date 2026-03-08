const SUITS = ["S", "H", "D", "C"];
const SUIT_SYMBOLS = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
  J: "★"
};

const SUIT_NAMES = {
  S: "spade",
  H: "heart",
  D: "diamond",
  C: "club",
  J: "joker"
};

const RANK_LABELS = {
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
  15: "2",
  16: "JOKER"
};

const NORMAL_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const REVOLUTION_ORDER = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 16];

function createDeck(jokerCount = 2) {
  const deck = [];

  for (const suit of SUITS) {
    for (let rank = 3; rank <= 15; rank += 1) {
      deck.push({
        id: `${suit}${rank}`,
        suit,
        rank,
        isJoker: false
      });
    }
  }

  for (let index = 0; index < jokerCount; index += 1) {
    deck.push({
      id: `J${index + 1}`,
      suit: "J",
      rank: 16,
      isJoker: true
    });
  }

  return deck;
}

function shuffle(cards) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function getStrengthRank(rank, reversed) {
  const order = reversed ? REVOLUTION_ORDER : NORMAL_ORDER;
  const index = order.indexOf(rank);
  return index === -1 ? -1 : index;
}

function compareRanks(rankA, rankB, reversed) {
  return getStrengthRank(rankA, reversed) - getStrengthRank(rankB, reversed);
}

function sortCards(cards, reversed = false) {
  return [...cards].sort((cardA, cardB) => {
    const rankOrder = compareRanks(cardA.rank, cardB.rank, reversed);
    if (rankOrder !== 0) {
      return rankOrder;
    }
    return SUITS.indexOf(cardA.suit) - SUITS.indexOf(cardB.suit);
  });
}

function cardLabel(card) {
  if (card.isJoker) {
    return "JOKER";
  }
  return `${SUIT_SYMBOLS[card.suit]}${RANK_LABELS[card.rank]}`;
}

function rankLabel(rank) {
  return RANK_LABELS[rank] || String(rank);
}

function serializeCard(card) {
  return {
    id: card.id,
    suit: card.suit,
    rank: card.rank,
    isJoker: card.isJoker,
    label: cardLabel(card),
    suitSymbol: SUIT_SYMBOLS[card.suit],
    suitName: SUIT_NAMES[card.suit]
  };
}

module.exports = {
  NORMAL_ORDER,
  REVOLUTION_ORDER,
  SUITS,
  SUIT_SYMBOLS,
  createDeck,
  shuffle,
  compareRanks,
  sortCards,
  cardLabel,
  rankLabel,
  serializeCard
};
