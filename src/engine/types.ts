export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs' | 'joker';

export type Rank =
    | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
    | 'J' | 'Q' | 'K' | 'A' | '2' | 'Joker';

export const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export interface CardDef {
    suit: Suit;
    rank: Rank;
    strength: number; // 3=0, ... 2=12, Joker=13
    id: string; // Unique ID for React keys
}

export type PlayerId = string;

/** Rank titles from best to worst */
export type PlayerRankTitle = 'daifugo' | 'fugo' | 'heimin' | 'hinmin' | 'daihinmin';

/** Game phases */
export type GamePhase = 'waiting' | 'card_exchange' | 'playing' | 'round_end' | 'game_over';

/** Move type classification */
export type MoveType = 'single' | 'pair' | 'triple' | 'quad' | 'sequence';

/** Game effect types for UI animation */
export type GameEffectType =
    | 'revolution'         // 革命 - ⚡稲妻 + 画面シェイク
    | 'revolution_cancel'  // 革命返し
    | 'eight_stop'         // 8切り - ✂️カット演出
    | 'eleven_back'        // 11バック - 🔄強さ反転
    | 'suit_lock'          // 縛り - 🔒チェーン
    | 'super_lock'         // 激縛り - 🔒🔒ダブルチェーン
    | 'five_skip'          // 5スキップ - ⏭️
    | 'seven_pass'         // 7渡し - 📤
    | 'ten_discard'        // 10捨て - 🗑️
    | 'spade_three'        // スペ3返し - ♠️3光る
    | 'nine_reverse'       // 9リバース - 🔃
    | 'sandstorm'          // 砂嵐 - 🌪️
    | 'ambulance'          // 救急車 - 🚑
    | 'q_bomber'           // Qボンバー - 💣
    | 'pile_clear'         // 場流し - 渦巻き消え
    | 'player_finish'      // 上がり - 🎉/😢
    | 'forbidden_finish'   // 反則上がり - ❌
    | 'capital_fall'       // 都落ち - 📉
    | 'gekokujo'           // 下剋上 - 👑反転
    | 'cataclysm'          // 天変地異 - 🌋
    | 'card_exchange'      // カード交換 - 🔄
    | 'sequence_revolution'; // 階段革命

export interface GameEffect {
    type: GameEffectType;
    /** Player who triggered the effect */
    playerId?: PlayerId;
    /** Extra data for rendering (e.g., target rank for Q-Bomber) */
    data?: Record<string, unknown>;
    /** Timestamp for dedup */
    timestamp: number;
}

export interface Player {
    id: PlayerId;
    name: string;
    hand: CardDef[];
    isCpu: boolean;
    rank: number | null; // Finishing order: 1st, 2nd, etc. (null if not finished)
    rankTitle: PlayerRankTitle | null; // Daifugo, Fugo, etc.
    hasPassed: boolean;
    /** Score accumulated across rounds */
    score: number;
    /** Number of rounds won as Daifugo */
    daifugoWins: number;
    /** Consecutive win streak */
    streak: number;
}

export interface Move {
    cards: CardDef[];
    playerId: PlayerId;
    moveType: MoveType;
}

/** Suit lock state tracking */
export interface SuitLockState {
    active: boolean;
    /** Locked suits (one per card in the combo) */
    suits: Suit[];
    /** For super lock: the last rank played (to enforce consecutive) */
    lastRank?: number;
}

export interface GameState {
    players: Player[];
    currentTurn: PlayerId;
    pile: Move[]; // The stack of played moves in current trick
    history: Move[]; // Full history of all moves this round
    isRevolution: boolean;
    /** Temporary revolution from J-Back (11バック), resets when pile clears */
    isElevenBack: boolean;
    winners: PlayerId[]; // List of players who have finished, in order
    phase: GamePhase;
    /** Current round number (1-based) */
    roundNumber: number;
    /** Turn direction: 1 = clockwise, -1 = counter-clockwise */
    turnDirection: 1 | -1;
    /** Suit lock state */
    suitLock: SuitLockState;
    /** Number of players to skip (from 5-skip) */
    skipCount: number;
    /** Cards to give to next player (from 7-pass) */
    pendingGiveCards: number;
    /** Cards to discard (from 10-discard) */
    pendingDiscardCount: number;
    /** Player who needs to discard/give cards */
    pendingActionPlayerId: PlayerId | null;
    /** Previous round rankings for card exchange and capital fall */
    previousRankings: { playerId: PlayerId; rankTitle: PlayerRankTitle }[];
    /** Q-Bomber: pending target rank to discard from all hands */
    pendingQBomberRank: Rank | null;
    /** Last game effect for UI animation */
    lastEffect: GameEffect | null;
    /** Effect queue for multiple simultaneous effects */
    effectQueue: GameEffect[];
}

/** Match result for tracking */
export interface MatchResult {
    roundNumber: number;
    rankings: { playerId: PlayerId; playerName: string; rankTitle: PlayerRankTitle; score: number }[];
    timestamp: number;
}

/** Scoring points per rank title */
export const RANK_SCORES: Record<PlayerRankTitle, number> = {
    daifugo: 3,
    fugo: 1,
    heimin: 0,
    hinmin: -1,
    daihinmin: -3,
};

/** Get rank title based on finishing position and player count */
export function getRankTitle(finishPosition: number, playerCount: number): PlayerRankTitle {
    if (playerCount <= 3) {
        if (finishPosition === 1) return 'daifugo';
        if (finishPosition === playerCount) return 'daihinmin';
        return 'heimin';
    }
    if (finishPosition === 1) return 'daifugo';
    if (finishPosition === 2) return 'fugo';
    if (finishPosition === playerCount - 1) return 'hinmin';
    if (finishPosition === playerCount) return 'daihinmin';
    return 'heimin';
}

/** Rank title display names */
export const RANK_TITLE_LABELS: Record<PlayerRankTitle, { ja: string; en: string }> = {
    daifugo: { ja: '大富豪', en: 'Daifugo' },
    fugo: { ja: '富豪', en: 'Fugo' },
    heimin: { ja: '平民', en: 'Heimin' },
    hinmin: { ja: '貧民', en: 'Hinmin' },
    daihinmin: { ja: '大貧民', en: 'Daihinmin' },
};

/** Effect display labels */
export const EFFECT_LABELS: Record<GameEffectType, { ja: string; emoji: string }> = {
    revolution: { ja: '革命!', emoji: '⚡' },
    revolution_cancel: { ja: '革命返し!', emoji: '⚡' },
    eight_stop: { ja: '8切り!', emoji: '✂️' },
    eleven_back: { ja: '11バック!', emoji: '🔄' },
    suit_lock: { ja: '縛り!', emoji: '🔒' },
    super_lock: { ja: '激縛り!', emoji: '🔒' },
    five_skip: { ja: 'スキップ!', emoji: '⏭️' },
    seven_pass: { ja: '7渡し!', emoji: '📤' },
    ten_discard: { ja: '10捨て!', emoji: '🗑️' },
    spade_three: { ja: 'スペ3返し!', emoji: '♠️' },
    nine_reverse: { ja: '9リバース!', emoji: '🔃' },
    sandstorm: { ja: '砂嵐!', emoji: '🌪️' },
    ambulance: { ja: '救急車!', emoji: '🚑' },
    q_bomber: { ja: 'Qボンバー!', emoji: '💣' },
    pile_clear: { ja: '場流し', emoji: '🌀' },
    player_finish: { ja: '上がり!', emoji: '🎉' },
    forbidden_finish: { ja: '反則上がり!', emoji: '❌' },
    capital_fall: { ja: '都落ち!', emoji: '📉' },
    gekokujo: { ja: '下剋上!', emoji: '👑' },
    cataclysm: { ja: '天変地異!', emoji: '🌋' },
    card_exchange: { ja: 'カード交換', emoji: '🔄' },
    sequence_revolution: { ja: '階段革命!', emoji: '⚡' },
};
