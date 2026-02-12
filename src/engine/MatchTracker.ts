import { type MatchResult } from './types';

const STORAGE_KEY = 'daifugo-match-history';

export class MatchTracker {
    private history: MatchResult[] = [];

    constructor() {
        this.loadFromStorage();
    }

    /** Record a round result */
    public recordRound(result: MatchResult): void {
        this.history.push(result);
        this.saveToStorage();
    }

    /** Get all match history */
    public getHistory(): MatchResult[] {
        return [...this.history];
    }

    /** Get total scores per player name across all matches */
    public getLeaderboard(): { name: string; totalScore: number; wins: number; games: number }[] {
        const stats: Record<string, { totalScore: number; wins: number; games: number }> = {};

        for (const result of this.history) {
            for (const r of result.rankings) {
                if (!stats[r.playerName]) {
                    stats[r.playerName] = { totalScore: 0, wins: 0, games: 0 };
                }
                stats[r.playerName].totalScore += r.score;
                stats[r.playerName].games++;
                if (r.rankTitle === 'daifugo') {
                    stats[r.playerName].wins++;
                }
            }
        }

        return Object.entries(stats)
            .map(([name, s]) => ({ name, ...s }))
            .sort((a, b) => b.totalScore - a.totalScore);
    }

    /** Clear all history */
    public clearHistory(): void {
        this.history = [];
        this.saveToStorage();
    }

    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                this.history = JSON.parse(data);
            }
        } catch {
            this.history = [];
        }
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
        } catch {
            // Storage full or unavailable
        }
    }
}
