import {
    type CardDef,
    type GameState,
    type Player,
    type PlayerId,
    type Move,
    type MoveType,
    type GameEffect,
    type GameEffectType,
    type Rank,
    type PlayerRankTitle,
    getRankTitle,
    RANK_SCORES,
} from './types';
import { CardHelper } from './Card';
import { type RuleConfig, DEFAULT_RULES } from './Rules';

export class GameEngine {
    private state: GameState;
    private rules: RuleConfig;

    constructor(rules: RuleConfig = DEFAULT_RULES) {
        this.rules = rules;
        this.state = this.getInitialState();
    }

    public getRules(): RuleConfig {
        return this.rules;
    }

    public setRules(rules: RuleConfig): void {
        this.rules = rules;
    }

    private getInitialState(): GameState {
        return {
            players: [],
            currentTurn: '',
            pile: [],
            history: [],
            isRevolution: false,
            isElevenBack: false,
            winners: [],
            phase: 'waiting',
            roundNumber: 0,
            turnDirection: 1,
            suitLock: { active: false, suits: [] },
            skipCount: 0,
            pendingGiveCards: 0,
            pendingDiscardCount: 0,
            pendingActionPlayerId: null,
            previousRankings: [],
            pendingQBomberRank: null,
            pendingClearPile: false,
            lastEffect: null,
            effectQueue: [],
        };
    }

    private emitEffect(type: GameEffectType, playerId?: PlayerId, data?: Record<string, unknown>): void {
        const effect: GameEffect = { type, playerId, data, timestamp: Date.now() };
        this.state.lastEffect = effect;
        this.state.effectQueue.push(effect);
    }

    // =====================================================
    // GAME INITIALIZATION
    // =====================================================

    public initGame(playerNames: string[], isNewSession: boolean = true): GameState {
        const deck = CardHelper.createDeck(this.rules.jokerCount);
        const shuffled = CardHelper.shuffle(deck);

        const players: Player[] = playerNames.map((name, i) => ({
            id: `player-${i}`,
            name,
            hand: [],
            isCpu: i > 0,
            rank: null,
            rankTitle: null,
            hasPassed: false,
            score: isNewSession ? 0 : (this.state.players.find(p => p.name === name)?.score ?? 0),
            daifugoWins: isNewSession ? 0 : (this.state.players.find(p => p.name === name)?.daifugoWins ?? 0),
            streak: isNewSession ? 0 : (this.state.players.find(p => p.name === name)?.streak ?? 0),
        }));

        // Deal cards evenly
        shuffled.forEach((card, i) => {
            players[i % players.length].hand.push(card);
        });

        // Sort hands
        players.forEach(p => {
            p.hand = CardHelper.sortHand(p.hand, false);
        });

        // Find who has diamond-3 or just default to player 0
        const startingPlayer = this.findStartingPlayer(players) || players[0].id;

        this.state = {
            players,
            currentTurn: startingPlayer,
            pile: [],
            history: [],
            isRevolution: false,
            isElevenBack: false,
            winners: [],
            phase: 'playing',
            roundNumber: (this.state.roundNumber || 0) + 1,
            turnDirection: 1,
            suitLock: { active: false, suits: [] },
            skipCount: 0,
            pendingGiveCards: 0,
            pendingDiscardCount: 0,
            pendingActionPlayerId: null,
            previousRankings: this.state.previousRankings || [],
            pendingQBomberRank: null,
            pendingClearPile: false,
            lastEffect: null,
            effectQueue: [],
        };

        // 天変地異 (Cataclysm): Check if daihinmin has all cards ≤10
        if (this.rules.cataclysm && this.state.previousRankings.length > 0 && this.state.roundNumber > 1) {
            this.checkCataclysm();
        }

        // If card exchange is enabled and we have previous rankings
        if (this.rules.cardExchange && this.state.previousRankings.length > 0 && this.state.roundNumber > 1) {
            this.state.phase = 'card_exchange';
        }

        return { ...this.state };
    }

    /** Start a new round while preserving scores */
    public startNewRound(): GameState {
        // Save current rankings as previousRankings
        const rankings = this.state.winners.map((pid, i) => ({
            playerId: pid,
            rankTitle: getRankTitle(i + 1, this.state.players.length),
        }));
        // Add any players who didn't finish
        this.state.players.forEach(p => {
            if (!rankings.find(r => r.playerId === p.id)) {
                rankings.push({
                    playerId: p.id,
                    rankTitle: 'daihinmin' as PlayerRankTitle,
                });
            }
        });
        this.state.previousRankings = rankings;

        const names = this.state.players.map(p => p.name);
        return this.initGame(names, false);
    }

    private findStartingPlayer(players: Player[]): PlayerId | null {
        for (const p of players) {
            const hasDiamond3 = p.hand.some(c => c.suit === 'diamonds' && c.rank === '3');
            if (hasDiamond3) return p.id;
        }
        return null;
    }

    // =====================================================
    // CATACLYSM (天変地異)
    // =====================================================

    private checkCataclysm(): void {
        const prevDaihinmin = this.state.previousRankings.find(r => r.rankTitle === 'daihinmin');
        const prevDaifugo = this.state.previousRankings.find(r => r.rankTitle === 'daifugo');
        if (!prevDaihinmin || !prevDaifugo) return;

        const daihinminPlayer = this.state.players.find(p => p.id === prevDaihinmin.playerId);
        const daifugoPlayer = this.state.players.find(p => p.id === prevDaifugo.playerId);
        if (!daihinminPlayer || !daifugoPlayer) return;

        // Check if all of daihinmin's cards are ≤10 (strength 0-7, i.e. 3-10)
        const allLow = daihinminPlayer.hand.every(c => {
            if (c.rank === 'Joker') return false;
            const strength = CardHelper.getStrength(c.rank, false);
            return strength <= 7; // 3=0, 4=1, ..., 10=7
        });

        if (allLow) {
            // Swap entire hands
            const tempHand = [...daihinminPlayer.hand];
            daihinminPlayer.hand = [...daifugoPlayer.hand];
            daifugoPlayer.hand = tempHand;

            // Re-sort
            daihinminPlayer.hand = CardHelper.sortHand(daihinminPlayer.hand, false);
            daifugoPlayer.hand = CardHelper.sortHand(daifugoPlayer.hand, false);

            this.emitEffect('cataclysm', prevDaihinmin.playerId, {
                swappedWith: prevDaifugo.playerId,
            });
        }
    }

    // =====================================================
    // CARD EXCHANGE
    // =====================================================

    public executeCardExchange(exchanges: { fromId: PlayerId; toId: PlayerId; cards: CardDef[] }[]): GameState {
        for (const ex of exchanges) {
            const fromPlayer = this.state.players.find(p => p.id === ex.fromId);
            const toPlayer = this.state.players.find(p => p.id === ex.toId);
            if (!fromPlayer || !toPlayer) continue;

            const cardIds = new Set(ex.cards.map(c => c.id));
            fromPlayer.hand = fromPlayer.hand.filter(c => !cardIds.has(c.id));
            toPlayer.hand.push(...ex.cards);

            fromPlayer.hand = CardHelper.sortHand(fromPlayer.hand, this.state.isRevolution);
            toPlayer.hand = CardHelper.sortHand(toPlayer.hand, this.state.isRevolution);
        }

        this.emitEffect('card_exchange');
        this.state.phase = 'playing';
        return { ...this.state };
    }

    public autoCardExchange(): GameState {
        if (!this.rules.cardExchange || this.state.previousRankings.length === 0) {
            this.state.phase = 'playing';
            return { ...this.state };
        }

        const exchanges: { fromId: PlayerId; toId: PlayerId; cards: CardDef[] }[] = [];
        const prev = this.state.previousRankings;
        const daifugo = prev.find(r => r.rankTitle === 'daifugo');
        const fugo = prev.find(r => r.rankTitle === 'fugo');
        const hinmin = prev.find(r => r.rankTitle === 'hinmin');
        const daihinmin = prev.find(r => r.rankTitle === 'daihinmin');

        if (daifugo && daihinmin) {
            const n = this.rules.cardExchangeConfig.daifugoExchange;
            const daihinminPlayer = this.state.players.find(p => p.id === daihinmin.playerId);
            const daifugoPlayer = this.state.players.find(p => p.id === daifugo.playerId);
            if (daihinminPlayer && daifugoPlayer && n > 0) {
                const sorted = CardHelper.sortHand([...daihinminPlayer.hand], false);
                const bestCards = sorted.slice(-n);
                exchanges.push({ fromId: daihinmin.playerId, toId: daifugo.playerId, cards: bestCards });

                const dSorted = CardHelper.sortHand([...daifugoPlayer.hand], false);
                const worstCards = dSorted.slice(0, n);
                exchanges.push({ fromId: daifugo.playerId, toId: daihinmin.playerId, cards: worstCards });
            }
        }

        if (fugo && hinmin) {
            const m = this.rules.cardExchangeConfig.fugoExchange;
            const hinminPlayer = this.state.players.find(p => p.id === hinmin.playerId);
            const fugoPlayer = this.state.players.find(p => p.id === fugo.playerId);
            if (hinminPlayer && fugoPlayer && m > 0) {
                const sorted = CardHelper.sortHand([...hinminPlayer.hand], false);
                const bestCards = sorted.slice(-m);
                exchanges.push({ fromId: hinmin.playerId, toId: fugo.playerId, cards: bestCards });

                const fSorted = CardHelper.sortHand([...fugoPlayer.hand], false);
                const worstCards = fSorted.slice(0, m);
                exchanges.push({ fromId: fugo.playerId, toId: hinmin.playerId, cards: worstCards });
            }
        }

        return this.executeCardExchange(exchanges);
    }

    // =====================================================
    // GETTERS
    // =====================================================

    public getState(): GameState {
        return this.state;
    }

    // =====================================================
    // PLAY CARDS
    // =====================================================

    public playCards(playerId: PlayerId, cards: CardDef[]): GameState {
        if (this.state.currentTurn !== playerId) {
            throw new Error("Not your turn");
        }

        if (!this.isValidMove(cards)) {
            throw new Error("Invalid move");
        }

        // Clear previous effects
        this.state.effectQueue = [];
        this.state.lastEffect = null;

        const player = this.state.players.find(p => p.id === playerId)!;

        // Remove cards from hand
        const cardIds = new Set(cards.map(c => c.id));
        player.hand = player.hand.filter(c => !cardIds.has(c.id));

        // Classify move type
        const moveType = this.classifyMoveType(cards);

        // Add to pile
        const move: Move = { cards, playerId, moveType };
        this.state.pile.push(move);
        this.state.history.push(move);

        // Handle special effects BEFORE checking win
        const effects = this.handleSpecialEffects(cards, moveType, playerId);

        // Check forbidden finish
        if (player.hand.length === 0 && this.rules.forbiddenFinish) {
            if (this.isForbiddenFinish(cards)) {
                this.emitEffect('forbidden_finish', playerId);
                player.hand = [];
                this.state.winners.push(player.id);
                player.rank = this.state.players.length;
                player.rankTitle = 'daihinmin';
                player.score += RANK_SCORES['daihinmin'];
                this.clearPile();
                this.advanceTurnToNextActive(playerId);
                return { ...this.state };
            }
        }

        // Check win condition (player emptied their hand)
        if (player.hand.length === 0) {
            this.state.winners.push(player.id);
            player.rank = this.state.winners.length;
            player.rankTitle = getRankTitle(player.rank, this.state.players.length);
            player.score += RANK_SCORES[player.rankTitle];

            if (player.rankTitle === 'daifugo') {
                player.daifugoWins++;
                player.streak++;
            } else {
                player.streak = 0;
            }

            this.emitEffect('player_finish', playerId, {
                rank: player.rank,
                rankTitle: player.rankTitle,
                isFirst: player.rank === 1,
                isLast: false,
            });
        }

        // Check if game/round is over
        const activePlayers = this.state.players.filter(p => p.hand.length > 0);
        if (activePlayers.length <= 1) {
            if (activePlayers.length === 1) {
                const lastPlayer = activePlayers[0];
                if (!this.state.winners.includes(lastPlayer.id)) {
                    this.state.winners.push(lastPlayer.id);
                    lastPlayer.rank = this.state.winners.length;
                    lastPlayer.rankTitle = getRankTitle(lastPlayer.rank, this.state.players.length);
                    lastPlayer.score += RANK_SCORES[lastPlayer.rankTitle];
                    lastPlayer.streak = 0;

                    this.emitEffect('player_finish', lastPlayer.id, {
                        rank: lastPlayer.rank,
                        rankTitle: lastPlayer.rankTitle,
                        isFirst: false,
                        isLast: true,
                    });
                }
            }

            // Capital fall check
            if (this.rules.capitalFall) {
                this.checkCapitalFall();
            }

            // Gekokujo check
            if (this.rules.gekokujo) {
                this.checkGekokujo();
            }

            this.state.phase = 'round_end';
            return { ...this.state };
        }

        // --- Pending action setup ---
        // Q-Bomber: process FIRST (independent of pile clear)
        if (effects.pendingQBomber) {
            if (player.isCpu) {
                this.executeQBomber(playerId, this.cpuSelectQBomberTarget(player), false);
            } else {
                this.state.pendingQBomberRank = null; // Wait for player to declare
                this.state.pendingActionPlayerId = playerId;
            }
        }

        // 7-pass pending action
        if (effects.pendingGiveCards > 0 && player.hand.length > 0) {
            this.state.pendingGiveCards = effects.pendingGiveCards;
            this.state.pendingActionPlayerId = playerId;
        }

        // 10-discard pending action
        if (effects.pendingDiscardCount > 0 && player.hand.length > 0) {
            this.state.pendingDiscardCount = effects.pendingDiscardCount;
            this.state.pendingActionPlayerId = playerId;
        }

        // --- Turn advancement ---
        if (effects.clearPile) {
            // If there's a pending action, defer pile clear until action completes
            if (this.state.pendingActionPlayerId) {
                // Store that we need to clear pile after pending action
                this.state.pendingClearPile = true;
            } else {
                this.emitEffect('pile_clear', playerId);
                this.clearPile();
                if (player.hand.length === 0) {
                    this.advanceTurnToNextActive(playerId);
                } else {
                    this.state.currentTurn = playerId;
                    this.state.players.forEach(p => p.hasPassed = false);
                }
            }
        } else {
            if (effects.skipCount > 0) {
                this.state.skipCount = effects.skipCount;
            }

            // Only advance if no pending action required
            if (!this.state.pendingActionPlayerId) {
                this.advanceTurnToNext();
            }
        }

        return { ...this.state };
    }

    /** Execute Q-Bomber: all players discard cards of declared rank */
    public executeQBomber(playerId: PlayerId, targetRank: Rank, advanceTurn: boolean = true): GameState {
        this.emitEffect('q_bomber', playerId, { targetRank });
        this.state.pendingQBomberRank = null;
        this.state.pendingActionPlayerId = null;

        let totalDiscarded = 0;
        this.state.players.forEach(p => {
            const before = p.hand.length;
            p.hand = p.hand.filter(c => c.rank !== targetRank);
            totalDiscarded += before - p.hand.length;
        });

        // Handle deferred pile clear
        if (this.state.pendingClearPile) {
            this.state.pendingClearPile = false;
            this.emitEffect('pile_clear', playerId);
            this.clearPile();
            const player = this.state.players.find(p => p.id === playerId);
            if (player && player.hand.length > 0) {
                this.state.currentTurn = playerId;
                this.state.players.forEach(p => p.hasPassed = false);
            } else {
                this.advanceTurnToNextActive(playerId);
            }
        } else if (advanceTurn) {
            this.advanceTurnToNext();
        }

        return { ...this.state };
    }

    private cpuSelectQBomberTarget(player: Player): Rank {
        // Pick the rank that appears most in opponents' likely hands
        // Simple: pick a common rank that the CPU doesn't have many of
        const myRanks = new Set(player.hand.map(c => c.rank));
        const commonRanks: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
        // Pick the first rank we DON'T have
        for (const r of commonRanks) {
            if (!myRanks.has(r)) return r;
        }
        return '3';
    }

    /** Execute 7-pass: give cards to next player */
    public giveCards(playerId: PlayerId, cards: CardDef[]): GameState {
        if (this.state.pendingActionPlayerId !== playerId) {
            throw new Error("Not your pending action");
        }

        const fromPlayer = this.state.players.find(p => p.id === playerId)!;
        const nextPlayer = this.getNextActivePlayer(playerId);
        if (!nextPlayer) {
            this.state.pendingGiveCards = 0;
            this.state.pendingActionPlayerId = null;
            return { ...this.state };
        }

        const cardIds = new Set(cards.map(c => c.id));
        fromPlayer.hand = fromPlayer.hand.filter(c => !cardIds.has(c.id));
        nextPlayer.hand.push(...cards);
        nextPlayer.hand = CardHelper.sortHand(nextPlayer.hand, this.isEffectiveRevolution());

        this.state.pendingGiveCards = 0;
        this.state.pendingActionPlayerId = null;

        if (fromPlayer.hand.length === 0) {
            this.state.winners.push(fromPlayer.id);
            fromPlayer.rank = this.state.winners.length;
            fromPlayer.rankTitle = getRankTitle(fromPlayer.rank, this.state.players.length);
            fromPlayer.score += RANK_SCORES[fromPlayer.rankTitle];
        }

        // Handle deferred pile clear
        if (this.state.pendingClearPile) {
            this.state.pendingClearPile = false;
            this.emitEffect('pile_clear', playerId);
            this.clearPile();
            if (fromPlayer.hand.length > 0) {
                this.state.currentTurn = playerId;
                this.state.players.forEach(p => p.hasPassed = false);
            } else {
                this.advanceTurnToNextActive(playerId);
            }
        } else {
            this.advanceTurnToNext();
        }

        return { ...this.state };
    }

    /** Execute 10-discard: discard cards from hand */
    public discardCards(playerId: PlayerId, cards: CardDef[]): GameState {
        if (this.state.pendingActionPlayerId !== playerId) {
            throw new Error("Not your pending action");
        }

        const player = this.state.players.find(p => p.id === playerId)!;
        const cardIds = new Set(cards.map(c => c.id));
        player.hand = player.hand.filter(c => !cardIds.has(c.id));

        this.state.pendingDiscardCount = 0;
        this.state.pendingActionPlayerId = null;

        if (player.hand.length === 0) {
            this.state.winners.push(player.id);
            player.rank = this.state.winners.length;
            player.rankTitle = getRankTitle(player.rank, this.state.players.length);
            player.score += RANK_SCORES[player.rankTitle];
        }

        // Handle deferred pile clear
        if (this.state.pendingClearPile) {
            this.state.pendingClearPile = false;
            this.emitEffect('pile_clear', playerId);
            this.clearPile();
            if (player.hand.length > 0) {
                this.state.currentTurn = playerId;
                this.state.players.forEach(p => p.hasPassed = false);
            } else {
                this.advanceTurnToNextActive(playerId);
            }
        } else {
            this.advanceTurnToNext();
        }

        return { ...this.state };
    }

    // =====================================================
    // PASS
    // =====================================================

    public pass(playerId: PlayerId): GameState {
        if (this.state.currentTurn !== playerId) {
            throw new Error("Not your turn");
        }

        this.state.effectQueue = [];
        this.state.lastEffect = null;

        const player = this.state.players.find(p => p.id === playerId)!;
        player.hasPassed = true;

        this.advanceTurnToNext();
        return { ...this.state };
    }

    // =====================================================
    // MOVE VALIDATION
    // =====================================================

    public isValidMove(cards: CardDef[]): boolean {
        if (cards.length === 0) return false;

        const topMove = this.getTopMove();
        const isRev = this.isEffectiveRevolution();

        // Sandstorm (砂嵐): Three 3s beats anything
        if (this.rules.sandstorm && cards.length === 3) {
            const threes = cards.filter(c => c.rank === '3');
            if (threes.length === 3) {
                return true; // Beats everything
            }
        }

        // Spade-3 return: Can play Spade-3 on a single Joker
        if (this.rules.spadeThreeReturn && topMove) {
            if (cards.length === 1 && cards[0].suit === 'spades' && cards[0].rank === '3') {
                if (topMove.cards.length === 1 && topMove.cards[0].rank === 'Joker') {
                    return true;
                }
            }
        }

        // Super lock check (激縛り)
        if (this.rules.superLock && this.state.suitLock.active && this.state.suitLock.lastRank !== undefined && topMove) {
            const nonJokerCards = cards.filter(c => c.rank !== 'Joker');
            if (nonJokerCards.length > 0) {
                const lockedSuits = this.state.suitLock.suits;
                const expectedRank = this.state.suitLock.lastRank + 1;
                // In super lock, must play exact next rank in same suit
                if (cards.length === 1) {
                    const card = nonJokerCards[0];
                    const cardStrength = CardHelper.getStrength(card.rank, false);
                    if (card.suit !== lockedSuits[0] || cardStrength !== expectedRank) {
                        return false;
                    }
                    return true;
                }
            }
        }

        // Regular suit lock check
        if (this.state.suitLock.active && topMove && cards.length > 0 && !this.state.suitLock.lastRank) {
            const nonJokerCards = cards.filter(c => c.rank !== 'Joker');
            if (nonJokerCards.length > 0) {
                const lockedSuits = this.state.suitLock.suits;
                const suitsMatch = nonJokerCards.every((c, i) => {
                    if (i < lockedSuits.length) {
                        return c.suit === lockedSuits[i];
                    }
                    return true;
                });
                if (!suitsMatch) {
                    return false;
                }
                if (cards.length === 1 || (topMove && topMove.moveType !== 'sequence')) {
                    const cardSuit = nonJokerCards[0]?.suit;
                    if (cardSuit && !lockedSuits.includes(cardSuit)) {
                        return false;
                    }
                }
            }
        }

        // 1. Single card
        if (cards.length === 1) {
            if (topMove) {
                if (topMove.cards.length !== 1) return false;
                return this.calculateMoveStrength(cards, isRev) > this.calculateMoveStrength(topMove.cards, isRev);
            }
            return true;
        }

        // 2. Same rank (Pair / Triple / Quad)
        const nonJokers = cards.filter(c => c.rank !== 'Joker');
        const firstRank = nonJokers.length > 0 ? nonJokers[0].rank : null;
        const isSameRank = nonJokers.every(c => c.rank === firstRank);

        if (isSameRank && (nonJokers.length > 0 || cards.every(c => c.rank === 'Joker'))) {
            if (topMove) {
                if (topMove.cards.length !== cards.length) return false;
                if (topMove.moveType === 'sequence') return false;
                return this.calculateMoveStrength(cards, isRev) > this.calculateMoveStrength(topMove.cards, isRev);
            }
            return true;
        }

        // 3. Sequence
        if (this.rules.sequence && this.isSequence(cards)) {
            if (topMove) {
                if (topMove.cards.length !== cards.length) return false;
                if (topMove.moveType !== 'sequence') return false;
                return this.calculateMoveStrength(cards, isRev) > this.calculateMoveStrength(topMove.cards, isRev);
            }
            return true;
        }

        return false;
    }

    /** Get all valid moves for a player (for AI and UI hints) */
    public getValidMoves(playerId: PlayerId): CardDef[][] {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player) return [];

        const validMoves: CardDef[][] = [];
        const hand = player.hand;

        // Singles
        for (const card of hand) {
            if (this.isValidMove([card])) {
                validMoves.push([card]);
            }
        }

        // Pairs/Triples/Quads
        const rankGroups = this.groupByRank(hand);
        for (const group of Object.values(rankGroups)) {
            if (group.length >= 2) {
                for (let size = 2; size <= Math.min(group.length, 4); size++) {
                    const combos = this.combinations(group, size);
                    for (const combo of combos) {
                        if (this.isValidMove(combo)) {
                            validMoves.push(combo);
                        }
                    }
                }
            }
        }

        // Sequences
        if (this.rules.sequence) {
            const suitGroups = this.groupBySuit(hand);
            for (const suitCards of Object.values(suitGroups)) {
                if (suitCards.length >= 3) {
                    const sorted = CardHelper.sortHand(suitCards, this.isEffectiveRevolution());
                    for (let start = 0; start < sorted.length - 2; start++) {
                        for (let end = start + 2; end < sorted.length; end++) {
                            const seq = sorted.slice(start, end + 1);
                            if (this.isSequence(seq) && this.isValidMove(seq)) {
                                validMoves.push(seq);
                            }
                        }
                    }
                }
            }
        }

        // Sandstorm: three 3s
        if (this.rules.sandstorm) {
            const threes = hand.filter(c => c.rank === '3');
            if (threes.length >= 3) {
                const combo = threes.slice(0, 3);
                if (this.isValidMove(combo)) {
                    validMoves.push(combo);
                }
            }
        }

        return validMoves;
    }

    // =====================================================
    // MOVE CLASSIFICATION
    // =====================================================

    private classifyMoveType(cards: CardDef[]): MoveType {
        if (cards.length === 1) return 'single';
        if (this.isSequence(cards)) return 'sequence';
        if (cards.length === 2) return 'pair';
        if (cards.length === 3) return 'triple';
        if (cards.length >= 4) return 'quad';
        return 'single';
    }

    private isSequence(cards: CardDef[]): boolean {
        if (cards.length < 3) return false;
        const isRev = this.isEffectiveRevolution();
        const sorted = [...cards].sort((a, b) =>
            CardHelper.getStrength(a.rank, isRev) - CardHelper.getStrength(b.rank, isRev)
        );

        const nonJokers = sorted.filter(c => c.suit !== 'joker');
        if (nonJokers.length === 0) return false;
        const firstSuit = nonJokers[0].suit;
        if (!nonJokers.every(c => c.suit === firstSuit)) return false;

        for (let i = 0; i < sorted.length - 1; i++) {
            const s1 = CardHelper.getStrength(sorted[i].rank, isRev);
            const s2 = CardHelper.getStrength(sorted[i + 1].rank, isRev);
            if (s2 !== s1 + 1) return false;
        }
        return true;
    }

    // =====================================================
    // SPECIAL EFFECTS
    // =====================================================

    private handleSpecialEffects(cards: CardDef[], moveType: MoveType, playerId: PlayerId): {
        clearPile: boolean;
        skipCount: number;
        pendingGiveCards: number;
        pendingDiscardCount: number;
        pendingQBomber: boolean;
    } {
        let clearPile = false;
        let skipCount = 0;
        let pendingGiveCards = 0;
        let pendingDiscardCount = 0;
        let pendingQBomber = false;

        // Revolution (4+ same rank cards)
        if (this.rules.revolution && moveType !== 'sequence' && cards.length >= 4) {
            const wasRev = this.state.isRevolution;
            this.state.isRevolution = !this.state.isRevolution;
            this.state.players.forEach(p => {
                p.hand = CardHelper.sortHand(p.hand, this.state.isRevolution);
            });
            this.emitEffect(wasRev ? 'revolution_cancel' : 'revolution', playerId);
        }

        // Sequence Revolution (5+ cards in sequence)
        if (this.rules.sequenceRevolution && moveType === 'sequence' && cards.length >= 5) {
            this.state.isRevolution = !this.state.isRevolution;
            this.state.players.forEach(p => {
                p.hand = CardHelper.sortHand(p.hand, this.state.isRevolution);
            });
            this.emitEffect('sequence_revolution', playerId);
        }

        // Sandstorm (砂嵐): Three 3s clear the pile
        if (this.rules.sandstorm && cards.length === 3 && cards.filter(c => c.rank === '3').length === 3) {
            clearPile = true;
            this.emitEffect('sandstorm', playerId);
        }

        // 8-Stop
        if (this.rules.eightStop && cards.some(c => c.rank === '8')) {
            clearPile = true;
            this.emitEffect('eight_stop', playerId);
        }

        // Ambulance (救急車): Two 9s clear the pile
        if (this.rules.ambulance && cards.length === 2 && cards.filter(c => c.rank === '9').length === 2) {
            clearPile = true;
            this.emitEffect('ambulance', playerId);
        }

        // 11-Back (J-Back)
        if (this.rules.elevenBack && cards.some(c => c.rank === 'J')) {
            this.state.isElevenBack = !this.state.isElevenBack;
            this.emitEffect('eleven_back', playerId);
        }

        // 5-Skip
        if (this.rules.fiveSkip && cards.some(c => c.rank === '5')) {
            skipCount = cards.filter(c => c.rank === '5').length;
            this.emitEffect('five_skip', playerId, { count: skipCount });
        }

        // 7-Pass
        if (this.rules.sevenPass && cards.some(c => c.rank === '7')) {
            pendingGiveCards = cards.filter(c => c.rank === '7').length;
            this.emitEffect('seven_pass', playerId, { count: pendingGiveCards });
        }

        // 10-Discard
        if (this.rules.tenDiscard && cards.some(c => c.rank === '10')) {
            pendingDiscardCount = cards.filter(c => c.rank === '10').length;
            this.emitEffect('ten_discard', playerId, { count: pendingDiscardCount });
        }

        // 9-Reverse (新9リバース)
        if (this.rules.nineReverse && cards.some(c => c.rank === '9')) {
            this.state.turnDirection = this.state.turnDirection === 1 ? -1 : 1;
            this.emitEffect('nine_reverse', playerId);
        }
        // Legacy reverse (on 9)
        else if (this.rules.reverse && cards.some(c => c.rank === '9')) {
            this.state.turnDirection = this.state.turnDirection === 1 ? -1 : 1;
        }

        // Q-Bomber
        if (this.rules.qBomber && cards.some(c => c.rank === 'Q')) {
            pendingQBomber = true;
        }

        // Suit lock detection
        this.updateSuitLock(cards);

        // Spade-3 return beats joker → clear pile
        if (this.rules.spadeThreeReturn) {
            const topMove = this.state.pile.length >= 2 ? this.state.pile[this.state.pile.length - 2] : undefined;
            if (topMove && topMove.cards.length === 1 && topMove.cards[0].rank === 'Joker') {
                if (cards.length === 1 && cards[0].suit === 'spades' && cards[0].rank === '3') {
                    clearPile = true;
                    this.emitEffect('spade_three', playerId);
                }
            }
        }

        return { clearPile, skipCount, pendingGiveCards, pendingDiscardCount, pendingQBomber };
    }

    // =====================================================
    // SUIT LOCK
    // =====================================================

    private updateSuitLock(cards: CardDef[]): void {
        if (!this.rules.suitLock && !this.rules.superLock) return;

        const topMove = this.state.pile.length >= 2 ? this.state.pile[this.state.pile.length - 2] : undefined;
        if (!topMove) {
            this.state.suitLock = { active: false, suits: [] };
            return;
        }

        const prevSuits = topMove.cards.filter(c => c.rank !== 'Joker').map(c => c.suit);
        const currSuits = cards.filter(c => c.rank !== 'Joker').map(c => c.suit);

        if (prevSuits.length > 0 && currSuits.length > 0) {
            if (prevSuits.length === 1 && currSuits.length === 1 && prevSuits[0] === currSuits[0]) {
                const lockedSuits = [prevSuits[0]];

                // Check for super lock (same suit + consecutive rank)
                if (this.rules.superLock) {
                    const prevStrength = CardHelper.getStrength(topMove.cards[0].rank, false);
                    const currStrength = CardHelper.getStrength(cards[0].rank, false);
                    if (currStrength === prevStrength + 1) {
                        this.state.suitLock = { active: true, suits: lockedSuits, lastRank: currStrength };
                        this.emitEffect('super_lock');
                        return;
                    }
                }

                this.state.suitLock = { active: true, suits: lockedSuits };
                this.emitEffect('suit_lock');
            } else if (prevSuits.length === currSuits.length) {
                const sorted1 = [...prevSuits].sort();
                const sorted2 = [...currSuits].sort();
                if (sorted1.every((s, i) => s === sorted2[i])) {
                    this.state.suitLock = { active: true, suits: sorted1 };
                    this.emitEffect('suit_lock');
                }
            }
        }
    }

    // =====================================================
    // FORBIDDEN FINISH
    // =====================================================

    private isForbiddenFinish(cards: CardDef[]): boolean {
        if (!this.rules.forbiddenFinish) return false;

        for (const card of cards) {
            if (this.rules.forbiddenFinishCards.includes(card.rank as '2' | '8' | 'Joker')) {
                return true;
            }
        }
        return false;
    }

    // =====================================================
    // CAPITAL FALL (都落ち)
    // =====================================================

    private checkCapitalFall(): void {
        if (!this.rules.capitalFall || this.state.previousRankings.length === 0) return;

        const prevDaifugo = this.state.previousRankings.find(r => r.rankTitle === 'daifugo');
        if (!prevDaifugo) return;

        const currentRank = this.state.winners.indexOf(prevDaifugo.playerId);
        if (currentRank !== 0) {
            const player = this.state.players.find(p => p.id === prevDaifugo.playerId);
            if (player) {
                player.rankTitle = 'daihinmin';
                player.score += RANK_SCORES['daihinmin'];
                this.emitEffect('capital_fall', prevDaifugo.playerId);
            }
        }
    }

    // =====================================================
    // GEKOKUJO (下剋上)
    // =====================================================

    private checkGekokujo(): void {
        if (!this.rules.gekokujo || this.state.previousRankings.length === 0) return;

        const prevDaihinmin = this.state.previousRankings.find(r => r.rankTitle === 'daihinmin');
        if (!prevDaihinmin) return;

        // Check if previous daihinmin finished first this round
        if (this.state.winners.length > 0 && this.state.winners[0] === prevDaihinmin.playerId) {
            // Reverse all rankings!
            this.emitEffect('gekokujo', prevDaihinmin.playerId);
            // The actual rank reversal happens naturally since they already finished first
        }
    }

    // =====================================================
    // HELPERS
    // =====================================================

    public isEffectiveRevolution(): boolean {
        return this.state.isRevolution !== this.state.isElevenBack;
    }

    private getTopMove(): Move | undefined {
        if (this.state.pile.length === 0) return undefined;
        return this.state.pile[this.state.pile.length - 1];
    }

    private calculateMoveStrength(cards: CardDef[], isRev: boolean): number {
        const nonJokers = cards.filter(c => c.rank !== 'Joker');
        if (nonJokers.length === 0) return CardHelper.getStrength('Joker', isRev);
        if (cards.length >= 3 && this.isSequence(cards)) {
            const strengths = nonJokers.map(c => CardHelper.getStrength(c.rank, isRev));
            return Math.max(...strengths);
        }
        return CardHelper.getStrength(nonJokers[0].rank, isRev);
    }

    private clearPile(): void {
        this.state.pile = [];
        this.state.players.forEach(p => p.hasPassed = false);
        this.state.suitLock = { active: false, suits: [] };
        this.state.isElevenBack = false;
        this.state.skipCount = 0;
        this.state.pendingClearPile = false;
    }

    private advanceTurnToNext(): void {
        const dir = this.state.turnDirection;
        const currentIndex = this.state.players.findIndex(p => p.id === this.state.currentTurn);
        let foundNext = false;

        let skip = this.state.skipCount;
        this.state.skipCount = 0;

        // Iterate through players in turn direction.
        // We need enough iterations to go around the table plus skip count.
        const maxIter = this.state.players.length * 2;

        for (let i = 1; i <= maxIter; i++) {
            const nextIndex = ((currentIndex + (i * dir)) % this.state.players.length + this.state.players.length) % this.state.players.length;
            const p = this.state.players[nextIndex];

            // Skip finished players entirely (don't count towards skip)
            if (p.hand.length === 0) continue;

            // Skip passed players entirely (don't count towards skip)
            if (p.hasPassed) continue;

            // This is an eligible player - should they be skipped by 5-skip?
            if (skip > 0) {
                skip--;
                continue;
            }

            this.state.currentTurn = p.id;
            foundNext = true;
            break;
        }

        if (!foundNext) {
            // No eligible player found — everyone has passed or been skipped.
            // The trick winner (top move owner) leads the next trick.
            const lastMove = this.getTopMove();
            if (lastMove) {
                const winnerId = lastMove.playerId;
                const winner = this.state.players.find(p => p.id === winnerId);

                this.emitEffect('pile_clear', winnerId);
                this.clearPile();
                if (winner && winner.hand.length > 0) {
                    this.state.currentTurn = winnerId;
                } else {
                    this.advanceTurnToNextActive(winnerId || this.state.currentTurn);
                }
            } else {
                this.advanceTurnToNextActive(this.state.currentTurn);
            }
        } else {
            // Found next player, but check if they are the pile owner
            // (everyone else passed/skipped → trick is won, pile should clear)
            const topMove = this.getTopMove();
            if (topMove && topMove.playerId === this.state.currentTurn) {
                // This player owns the top move and it came back to them.
                // Trick clear!
                this.emitEffect('pile_clear', this.state.currentTurn);
                this.clearPile();
                // They start the next trick
            }
        }
    }

    private advanceTurnToNextActive(startPlayerId: PlayerId): void {
        const dir = this.state.turnDirection;
        const currentIndex = this.state.players.findIndex(p => p.id === startPlayerId);
        for (let i = 1; i <= this.state.players.length; i++) {
            const nextIndex = ((currentIndex + (i * dir)) % this.state.players.length + this.state.players.length) % this.state.players.length;
            if (this.state.players[nextIndex].hand.length > 0) {
                this.state.currentTurn = this.state.players[nextIndex].id;
                this.clearPile();
                return;
            }
        }
        this.state.phase = 'round_end';
    }

    private getNextActivePlayer(startPlayerId: PlayerId): Player | null {
        const dir = this.state.turnDirection;
        const currentIndex = this.state.players.findIndex(p => p.id === startPlayerId);
        for (let i = 1; i <= this.state.players.length; i++) {
            const nextIndex = ((currentIndex + (i * dir)) % this.state.players.length + this.state.players.length) % this.state.players.length;
            const p = this.state.players[nextIndex];
            if (p.hand.length > 0 && p.id !== startPlayerId) {
                return p;
            }
        }
        return null;
    }

    private groupByRank(hand: CardDef[]): Record<string, CardDef[]> {
        const groups: Record<string, CardDef[]> = {};
        for (const card of hand) {
            if (card.rank === 'Joker') continue;
            if (!groups[card.rank]) groups[card.rank] = [];
            groups[card.rank].push(card);
        }
        return groups;
    }

    private groupBySuit(hand: CardDef[]): Record<string, CardDef[]> {
        const groups: Record<string, CardDef[]> = {};
        for (const card of hand) {
            if (card.suit === 'joker') continue;
            if (!groups[card.suit]) groups[card.suit] = [];
            groups[card.suit].push(card);
        }
        return groups;
    }

    private combinations<T>(arr: T[], size: number): T[][] {
        if (size === 1) return arr.map(x => [x]);
        if (size === arr.length) return [arr];
        const result: T[][] = [];
        for (let i = 0; i <= arr.length - size; i++) {
            const rest = this.combinations(arr.slice(i + 1), size - 1);
            for (const combo of rest) {
                result.push([arr[i], ...combo]);
            }
        }
        return result;
    }
}
