import { type CardDef } from './types';
import { CardHelper } from './Card';
import { GameEngine } from './Game';

export class CPUEngine {
    private engine: GameEngine;
    private playerId: string;

    constructor(engine: GameEngine, playerId: string) {
        this.engine = engine;
        this.playerId = playerId;
    }

    /**
     * Decide the best move for this CPU player.
     * Strategy: Play the weakest valid move to conserve strong cards.
     */
    public decideMove(): CardDef[] | null {
        const state = this.engine.getState();
        if (state.currentTurn !== this.playerId) return null;

        const myPlayer = state.players.find(p => p.id === this.playerId);
        if (!myPlayer || myPlayer.hand.length === 0) return null;

        // Get all valid moves from the engine
        const validMoves = this.engine.getValidMoves(this.playerId);
        if (validMoves.length === 0) return null; // Pass

        // Sort moves by total strength (weakest first to conserve strong cards)
        const isRev = this.engine.isEffectiveRevolution();
        const scored = validMoves.map(move => ({
            move,
            strength: move.reduce((sum, c) => sum + CardHelper.getStrength(c.rank, isRev), 0),
            cardCount: move.length,
        }));

        // Strategy priorities:
        // 1. If pile is empty, play weakest single or pair
        // 2. If pile has cards, play the weakest valid combo that beats it
        // 3. Prefer multi-card plays to reduce hand size faster

        const pileTop = state.pile.length > 0 ? state.pile[state.pile.length - 1] : undefined;

        if (!pileTop) {
            // Leading: play the weakest card to start conservatively
            scored.sort((a, b) => a.strength - b.strength);
            return scored[0].move;
        }

        // Beating: play the weakest valid move
        scored.sort((a, b) => {
            // Prefer same card count as pile
            const aMatch = a.cardCount === pileTop.cards.length ? 0 : 1;
            const bMatch = b.cardCount === pileTop.cards.length ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            return a.strength - b.strength;
        });

        return scored[0].move;
    }

    /**
     * Decide which cards to give during 7-pass
     * Strategy: give the weakest cards
     */
    public decideGiveCards(count: number): CardDef[] {
        const state = this.engine.getState();
        const myPlayer = state.players.find(p => p.id === this.playerId);
        if (!myPlayer) return [];

        const isRev = this.engine.isEffectiveRevolution();
        const sorted = CardHelper.sortHand([...myPlayer.hand], isRev);
        // Give the weakest cards
        return sorted.slice(0, Math.min(count, sorted.length));
    }

    /**
     * Decide which cards to discard during 10-discard
     * Strategy: discard the weakest cards
     */
    public decideDiscardCards(count: number): CardDef[] {
        return this.decideGiveCards(count); // Same strategy
    }

    /**
     * Decide which cards to exchange (as Daifugo giving worst, as Daihinmin giving best)
     */
    public decideExchangeCards(count: number, givingBest: boolean): CardDef[] {
        const state = this.engine.getState();
        const myPlayer = state.players.find(p => p.id === this.playerId);
        if (!myPlayer) return [];

        const sorted = CardHelper.sortHand([...myPlayer.hand], false);
        if (givingBest) {
            // Daihinmin: give best cards
            return sorted.slice(-count);
        } else {
            // Daifugo: give worst cards
            return sorted.slice(0, count);
        }
    }
}
