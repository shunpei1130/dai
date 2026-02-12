import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './Game';
import { CardHelper } from './Card';

describe('GameEngine', () => {
    let game: GameEngine;

    beforeEach(() => {
        game = new GameEngine();
        // Mock deck or ensure deterministic behavior if possible, 
        // but for now we test general state transitions.
    });

    it('should initialize with 4 players', () => {
        const state = game.initGame(['P1', 'P2', 'P3', 'P4']);
        expect(state.players.length).toBe(4);
        expect(state.players[0].hand.length).toBeGreaterThan(0);
        expect(state.currentTurn).toBeTruthy();
    });

    it('should allow valid move and advance turn', () => {
        const state = game.initGame(['P1', 'P2', 'P3', 'P4']);
        const currentPlayerId = state.currentTurn;
        const player = state.players.find(p => p.id === currentPlayerId)!;

        // Find a single card to play
        const cardToPlay = player.hand[0]; // Assuming sorted locally or we sort
        // We know hand is sorted by GameEngine init

        // Play single
        const newState = game.playCards(currentPlayerId, [cardToPlay]);

        expect(newState.pile.length).toBe(1);
        expect(newState.pile[0].cards[0].id).toBe(cardToPlay.id);
        expect(newState.currentTurn).not.toBe(currentPlayerId);
    });

    it('should calculate strength correctly (Normal vs Revolution)', () => {
        // 3 < 2
        // Revolution: 3 > 2
        const rank3 = '3';
        const rank2 = '2';

        expect(CardHelper.getStrength(rank3, false)).toBeLessThan(CardHelper.getStrength(rank2, false));
        expect(CardHelper.getStrength(rank3, true)).toBeGreaterThan(CardHelper.getStrength(rank2, true));
    });
});
