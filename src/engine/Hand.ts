import { type CardDef, type Rank } from './types';
import { CardHelper } from './Card';

export class HandHelper {
    public static findPairs(hand: CardDef[]): CardDef[][] {
        const groups: Record<Rank, CardDef[]> = {} as any;
        hand.forEach(c => {
            if (c.rank === 'Joker') return; // Jokers handled separately
            if (!groups[c.rank]) groups[c.rank] = [];
            groups[c.rank].push(c);
        });

        const pairs: CardDef[][] = [];
        Object.values(groups).forEach(group => {
            if (group.length >= 2) {
                pairs.push(group);
                // Note: This returns all cards of that rank. 
                // The UI or logic needs to select specific 2 or 3 or 4.
            }
        });
        return pairs;
    }

    // Check if a selection is a valid move (e.g. 5-6-7 sequence)
    public static isSequence(cards: CardDef[], isRevolution: boolean): boolean {
        if (cards.length < 3) return false;

        // Sort by strength
        const sorted = [...cards].sort((a, b) =>
            CardHelper.getStrength(a.rank, isRevolution) - CardHelper.getStrength(b.rank, isRevolution)
        );

        // Check same suit
        const firstSuit = sorted[0].suit;
        if (firstSuit === 'joker') return false; // Sequence starting with Joker? logic complex
        // Simple logic: All must be same suit (except Joker)
        // Todo: Implement flexible Joker logic

        const allSameSuit = sorted.every(c => c.suit === firstSuit || c.suit === 'joker');
        if (!allSameSuit) return false;

        // Check consecutive strength
        for (let i = 0; i < sorted.length - 1; i++) {
            const s1 = CardHelper.getStrength(sorted[i].rank, isRevolution);
            const s2 = CardHelper.getStrength(sorted[i + 1].rank, isRevolution);
            if (s2 !== s1 + 1) return false;
        }

        return true;
    }
}
