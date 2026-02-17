import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './Game';
import { CardHelper } from './Card';
import { type CardDef, type GameState } from './types';
import { DEFAULT_RULES, type RuleConfig } from './Rules';

/** Helper: create a card with given rank and suit */
function makeCard(rank: string, suit: string, id: string): CardDef {
    return {
        rank: rank as any,
        suit: suit as any,
        strength: CardHelper.getStrength(rank as any, false),
        id,
    };
}

/** Helper: setup a game with controlled hands */
function setupGame(rules?: Partial<RuleConfig>): GameEngine {
    const mergedRules = { ...DEFAULT_RULES, ...rules };
    return new GameEngine(mergedRules);
}

describe('GameEngine', () => {
    let game: GameEngine;

    beforeEach(() => {
        game = new GameEngine();
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
        const cardToPlay = player.hand[0];

        const newState = game.playCards(currentPlayerId, [cardToPlay]);

        expect(newState.pile.length).toBe(1);
        expect(newState.pile[0].cards[0].id).toBe(cardToPlay.id);
        expect(newState.currentTurn).not.toBe(currentPlayerId);
    });

    it('should calculate strength correctly (Normal vs Revolution)', () => {
        const rank3 = '3';
        const rank2 = '2';

        expect(CardHelper.getStrength(rank3, false)).toBeLessThan(CardHelper.getStrength(rank2, false));
        expect(CardHelper.getStrength(rank3, true)).toBeGreaterThan(CardHelper.getStrength(rank2, true));
    });
});

describe('5-Skip Bug Fix', () => {
    it('should skip the NEXT player(s), not force the current player to play again', () => {
        const game = setupGame({ fiveSkip: true, eightStop: false });
        const state = game.initGame(['P1', 'P2', 'P3', 'P4']);

        // Manually set up: give player-0 a 5
        const p0 = state.players.find(p => p.id === 'player-0')!;
        const p1 = state.players.find(p => p.id === 'player-1')!;

        // Clear hands and set up controlled scenario
        const fiveCard = makeCard('5', 'hearts', 'five-h');

        // Inject the five into player-0's hand
        p0.hand = [fiveCard, makeCard('3', 'diamonds', 'three-d'), makeCard('4', 'spades', 'four-s')];

        // Give other players some cards
        p1.hand = [makeCard('6', 'hearts', 'six-h'), makeCard('7', 'spades', 'seven-s')];
        state.players[2].hand = [makeCard('8', 'clubs', 'eight-c'), makeCard('9', 'diamonds', 'nine-d')];
        state.players[3].hand = [makeCard('10', 'hearts', 'ten-h'), makeCard('J', 'spades', 'jack-s')];

        // Set player-0 as current turn with empty pile
        (game as any).state.currentTurn = 'player-0';
        (game as any).state.pile = [];

        // Play the 5
        const newState = game.playCards('player-0', [fiveCard]);

        // player-1 should be SKIPPED, so currentTurn should be player-2
        expect(newState.currentTurn).toBe('player-2');
        // player-0 should NOT have to play again
        expect(newState.currentTurn).not.toBe('player-0');
    });
});

describe('7-Pass Bug Fix', () => {
    it('should correctly advance turn after giving cards', () => {
        const game = setupGame({ sevenPass: true, eightStop: false, nineReverse: false });
        const state = game.initGame(['P1', 'P2', 'P3', 'P4']);

        const sevenCard = makeCard('7', 'hearts', 'seven-h');
        const giveCard = makeCard('3', 'diamonds', 'three-d');

        // Set up player-0 with a 7 and an extra card to give
        state.players[0].hand = [sevenCard, giveCard, makeCard('4', 'spades', 'four-s')];
        state.players[1].hand = [makeCard('6', 'hearts', 'six-h'), makeCard('8', 'spades', 'eight-s')];
        state.players[2].hand = [makeCard('9', 'clubs', 'nine-c'), makeCard('10', 'diamonds', 'ten-d')];
        state.players[3].hand = [makeCard('J', 'hearts', 'jack-h'), makeCard('Q', 'spades', 'queen-s')];

        (game as any).state.currentTurn = 'player-0';
        (game as any).state.pile = [];

        // Play the 7
        const afterPlay = game.playCards('player-0', [sevenCard]);

        // Should have a pending action for player-0 to give cards
        expect(afterPlay.pendingActionPlayerId).toBe('player-0');
        expect(afterPlay.pendingGiveCards).toBe(1);

        // Give a card
        const afterGive = game.giveCards('player-0', [giveCard]);

        // Pending action should be cleared
        expect(afterGive.pendingActionPlayerId).toBeNull();
        expect(afterGive.pendingGiveCards).toBe(0);

        // Turn should advance to the next player (not stay on player-0)
        // After 7-pass, game continues normally
        expect(afterGive.players[0].hand.length).toBe(1); // 4-s remains
        expect(afterGive.players[1].hand.length).toBe(3); // received giveCard
    });
});

describe('Q-Bomber Bug Fix', () => {
    it('should set pendingActionPlayerId for human Q-Bomber', () => {
        const game = setupGame({ qBomber: true, eightStop: false });
        const state = game.initGame(['P1', 'P2', 'P3', 'P4']);

        const queenCard = makeCard('Q', 'hearts', 'queen-h');

        state.players[0].hand = [queenCard, makeCard('3', 'diamonds', 'three-d'), makeCard('4', 'spades', 'four-s')];
        state.players[0].isCpu = false;
        state.players[1].hand = [makeCard('6', 'hearts', 'six-h'), makeCard('K', 'spades', 'king-s')];
        state.players[2].hand = [makeCard('9', 'clubs', 'nine-c'), makeCard('K', 'diamonds', 'king-d')];
        state.players[3].hand = [makeCard('J', 'hearts', 'jack-h'), makeCard('K', 'clubs', 'king-c')];

        (game as any).state.currentTurn = 'player-0';
        (game as any).state.pile = [];

        const afterPlay = game.playCards('player-0', [queenCard]);

        // Should have pending Q-Bomber action for player-0
        expect(afterPlay.pendingActionPlayerId).toBe('player-0');
    });

    it('should discard target rank from all players when Q-Bomber executes', () => {
        const game = setupGame({ qBomber: true, eightStop: false });
        const state = game.initGame(['P1', 'P2', 'P3', 'P4']);

        const queenCard = makeCard('Q', 'hearts', 'queen-h');

        state.players[0].hand = [queenCard, makeCard('3', 'diamonds', 'three-d'), makeCard('K', 'spades', 'king-s-p0')];
        state.players[0].isCpu = false;
        state.players[1].hand = [makeCard('K', 'hearts', 'king-h'), makeCard('6', 'spades', 'six-s')];
        state.players[2].hand = [makeCard('K', 'clubs', 'king-c'), makeCard('9', 'diamonds', 'nine-d')];
        state.players[3].hand = [makeCard('K', 'diamonds', 'king-d'), makeCard('J', 'hearts', 'jack-h')];

        (game as any).state.currentTurn = 'player-0';
        (game as any).state.pile = [];

        game.playCards('player-0', [queenCard]);
        const afterBomber = game.executeQBomber('player-0', 'K' as any, true);

        // All K cards should be removed from all players
        afterBomber.players.forEach(p => {
            const kings = p.hand.filter(c => c.rank === 'K');
            expect(kings.length).toBe(0);
        });
    });
});

describe('Trick Clearing', () => {
    it('should clear pile when all other players pass and return to pile owner', () => {
        const game = setupGame({ eightStop: false });
        const state = game.initGame(['P1', 'P2', 'P3', 'P4']);

        // Set up: player-0 plays, then other players pass
        const highCard = makeCard('A', 'hearts', 'ace-h');
        state.players[0].hand = [highCard, makeCard('3', 'diamonds', 'three-d')];
        state.players[1].hand = [makeCard('4', 'hearts', 'four-h'), makeCard('5', 'spades', 'five-s')];
        state.players[2].hand = [makeCard('4', 'clubs', 'four-c'), makeCard('5', 'diamonds', 'five-d')];
        state.players[3].hand = [makeCard('4', 'diamonds', 'four-d'), makeCard('5', 'hearts', 'five-h')];

        (game as any).state.currentTurn = 'player-0';
        (game as any).state.pile = [];

        // Player-0 plays Ace
        game.playCards('player-0', [highCard]);

        // All others pass
        game.pass('player-1');
        game.pass('player-2');
        const afterAllPass = game.pass('player-3');

        // Pile should be cleared and player-0 should lead
        expect(afterAllPass.pile.length).toBe(0);
        expect(afterAllPass.currentTurn).toBe('player-0');
    });
});
