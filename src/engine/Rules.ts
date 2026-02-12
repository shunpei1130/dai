/**
 * Comprehensive Daifugo Rule Configuration
 * Supports 22 rule variations commonly found in Japanese Daifugo.
 */

export interface CardExchangeConfig {
    /** Number of cards exchanged between Daifugo ↔ Daihinmin */
    daifugoExchange: number;
    /** Number of cards exchanged between Fugo ↔ Hinmin */
    fugoExchange: number;
}

export interface RuleConfig {
    // === Core Rules ===
    /** 革命: 4+ same-rank cards flip strength order */
    revolution: boolean;
    /** 8切り: Playing 8 clears pile, player leads next */
    eightStop: boolean;
    /** 階段: 3+ consecutive same-suit cards as a valid play */
    sequence: boolean;
    /** ジョーカー: Joker can substitute any card in pairs/sequences */
    jokerWild: boolean;

    // === Special Card Effects ===
    /** 11バック: Playing J temporarily reverses strength until pile clears */
    elevenBack: boolean;
    /** スペ3返し: Spade-3 can beat a single Joker */
    spadeThreeReturn: boolean;
    /** 5飛ばし: Playing 5 skips the next N players (N = number of 5s played) */
    fiveSkip: boolean;
    /** 7渡し: Playing 7 lets you give N cards to next player */
    sevenPass: boolean;
    /** 10捨て: Playing 10 lets you discard N extra cards */
    tenDiscard: boolean;
    /** リバース: Certain plays reverse turn direction */
    reverse: boolean;
    /** 9リバース: Playing 9 reverses turn direction */
    nineReverse: boolean;

    // === Suit & Lock Rules ===
    /** 縛り(スート縛り): Same suit played 2x consecutively locks suit */
    suitLock: boolean;
    /** 激縛り: Suit + number consecutive lock (♥4→♥5→♥6 only) */
    superLock: boolean;

    // === Special Combos ===
    /** 砂嵐(33返し): Three 3s beats anything, including Joker */
    sandstorm: boolean;
    /** 救急車(99車): Two 9s clears the pile (like 8-stop) */
    ambulance: boolean;
    /** Qボンバー: Playing Q forces all players to discard a declared rank */
    qBomber: boolean;

    // === Finishing Rules ===
    /** 禁止上がり: Cannot finish with certain cards (Joker, 2, 8, etc.) */
    forbiddenFinish: boolean;
    /** Which cards cannot be used to finish (only applies if forbiddenFinish is true) */
    forbiddenFinishCards: ('Joker' | '2' | '8')[];

    // === Between-Round Rules ===
    /** カード交換: Card exchange between ranks at start of round */
    cardExchange: boolean;
    /** Card exchange amounts */
    cardExchangeConfig: CardExchangeConfig;
    /** 都落ち: Previous Daifugo must finish 1st or becomes Daihinmin */
    capitalFall: boolean;
    /** 下剋上: Daihinmin finishing 1st reverses all ranks */
    gekokujo: boolean;
    /** 天変地異: Daihinmin with all cards ≤10 swaps entire hand */
    cataclysm: boolean;

    // === Sequence Variants ===
    /** 階段革命: 5+ card sequence triggers revolution */
    sequenceRevolution: boolean;

    // === Player Config ===
    /** Number of Jokers in the deck (1 or 2) */
    jokerCount: number;
}

export const DEFAULT_RULES: RuleConfig = {
    revolution: true,
    eightStop: true,
    sequence: true,
    jokerWild: true,

    elevenBack: true,
    spadeThreeReturn: true,
    fiveSkip: true,
    sevenPass: true,
    tenDiscard: true,
    reverse: false,
    nineReverse: true,

    suitLock: true,
    superLock: false,

    sandstorm: true,
    ambulance: true,
    qBomber: false,

    forbiddenFinish: true,
    forbiddenFinishCards: ['Joker', '2', '8'],

    cardExchange: true,
    cardExchangeConfig: {
        daifugoExchange: 2,
        fugoExchange: 1,
    },
    capitalFall: true,
    gekokujo: false,
    cataclysm: false,

    sequenceRevolution: true,

    jokerCount: 1,
};

/** Minimal rules for simple gameplay */
export const SIMPLE_RULES: RuleConfig = {
    revolution: true,
    eightStop: true,
    sequence: false,
    jokerWild: true,

    elevenBack: false,
    spadeThreeReturn: false,
    fiveSkip: false,
    sevenPass: false,
    tenDiscard: false,
    reverse: false,
    nineReverse: false,

    suitLock: false,
    superLock: false,

    sandstorm: false,
    ambulance: false,
    qBomber: false,

    forbiddenFinish: false,
    forbiddenFinishCards: [],

    cardExchange: false,
    cardExchangeConfig: { daifugoExchange: 0, fugoExchange: 0 },
    capitalFall: false,
    gekokujo: false,
    cataclysm: false,

    sequenceRevolution: false,

    jokerCount: 1,
};

/** All rules enabled for maximum chaos */
export const ALL_RULES: RuleConfig = {
    revolution: true,
    eightStop: true,
    sequence: true,
    jokerWild: true,

    elevenBack: true,
    spadeThreeReturn: true,
    fiveSkip: true,
    sevenPass: true,
    tenDiscard: true,
    reverse: true,
    nineReverse: true,

    suitLock: true,
    superLock: true,

    sandstorm: true,
    ambulance: true,
    qBomber: true,

    forbiddenFinish: true,
    forbiddenFinishCards: ['Joker', '2', '8'],

    cardExchange: true,
    cardExchangeConfig: {
        daifugoExchange: 2,
        fugoExchange: 1,
    },
    capitalFall: true,
    gekokujo: true,
    cataclysm: true,

    sequenceRevolution: true,

    jokerCount: 2,
};
