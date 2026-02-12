import { type CardDef, type Rank, RANKS, SUITS } from './types';

export class CardHelper {
    // Base strength mapping (Normal mode)
    // 3=0, 4=1, ... A=11, 2=12
    private static readonly STRENGTH_MAP: Record<Rank, number> = {
        '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6, '10': 7,
        'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12, 'Joker': 13
    };

    public static createDeck(jokerCount: number = 1): CardDef[] {
        const deck: CardDef[] = [];
        let idCounter = 0;

        for (const suit of SUITS) {
            for (const rank of RANKS) {
                deck.push({
                    suit,
                    rank,
                    strength: this.STRENGTH_MAP[rank],
                    id: `card-${idCounter++}`
                });
            }
        }

        // Add Joker(s)
        for (let j = 0; j < jokerCount; j++) {
            deck.push({
                suit: 'joker',
                rank: 'Joker',
                strength: 13,
                id: `card-${idCounter++}`
            });
        }

        return deck;
    }

    /** Fisher-Yates shuffle */
    public static shuffle(deck: CardDef[]): CardDef[] {
        const arr = [...deck];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    public static getStrength(rank: Rank, isRevolution: boolean): number {
        const strength = this.STRENGTH_MAP[rank];
        if (rank === 'Joker') return 13; // Joker is usually strongest

        if (isRevolution) {
            // Invert strength for normal cards (0-12)
            return 12 - strength;
        }
        return strength;
    }

    public static sortHand(hand: CardDef[], isRevolution: boolean): CardDef[] {
        return [...hand].sort((a, b) => {
            const strengthA = this.getStrength(a.rank, isRevolution);
            const strengthB = this.getStrength(b.rank, isRevolution);

            if (strengthA !== strengthB) {
                return strengthA - strengthB;
            }
            // Secondary sort by suit to keep them grouped
            if (a.suit !== b.suit) {
                return SUITS.indexOf(a.suit as any) - SUITS.indexOf(b.suit as any);
            }
            return 0;
        });
    }

    public static toDisplay(rank: Rank): string {
        return rank;
    }
}
