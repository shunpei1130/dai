import { v4 as uuidv4 } from 'uuid';
import { type RuleConfig, DEFAULT_RULES } from '../src/engine/Rules';

export interface RoomPlayer {
    id: string;       // Socket ID
    name: string;
    isHost: boolean;
    isReady: boolean;
}

export interface Room {
    code: string;
    hostId: string;
    players: RoomPlayer[];
    rules: RuleConfig;
    status: 'waiting' | 'playing' | 'finished';
    maxPlayers: number;
    createdAt: number;
}

export class RoomManager {
    private rooms: Map<string, Room> = new Map();

    /** Generate a short room code */
    private generateCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        // Ensure unique
        if (this.rooms.has(code)) return this.generateCode();
        return code;
    }

    /** Create a new room */
    createRoom(hostSocketId: string, hostName: string, rules?: Partial<RuleConfig>): Room {
        const code = this.generateCode();
        const room: Room = {
            code,
            hostId: hostSocketId,
            players: [{
                id: hostSocketId,
                name: hostName,
                isHost: true,
                isReady: true,
            }],
            rules: { ...DEFAULT_RULES, ...rules },
            status: 'waiting',
            maxPlayers: 4,
            createdAt: Date.now(),
        };
        this.rooms.set(code, room);
        return room;
    }

    /** Join an existing room */
    joinRoom(code: string, socketId: string, playerName: string): Room | null {
        const room = this.rooms.get(code);
        if (!room) return null;
        if (room.status !== 'waiting') return null;
        if (room.players.length >= room.maxPlayers) return null;
        if (room.players.find(p => p.id === socketId)) return room; // Already in room

        room.players.push({
            id: socketId,
            name: playerName,
            isHost: false,
            isReady: false,
        });
        return room;
    }

    /** Leave a room */
    leaveRoom(code: string, socketId: string): Room | null {
        const room = this.rooms.get(code);
        if (!room) return null;

        room.players = room.players.filter(p => p.id !== socketId);

        // If room is empty, delete it
        if (room.players.length === 0) {
            this.rooms.delete(code);
            return null;
        }

        // If host left, assign new host
        if (room.hostId === socketId) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
        }

        return room;
    }

    /** Get room by code */
    getRoom(code: string): Room | null {
        return this.rooms.get(code) || null;
    }

    /** Get room by player socket ID */
    getRoomByPlayerId(socketId: string): Room | null {
        for (const room of this.rooms.values()) {
            if (room.players.find(p => p.id === socketId)) {
                return room;
            }
        }
        return null;
    }

    /** Set player ready status */
    setReady(code: string, socketId: string, ready: boolean): Room | null {
        const room = this.rooms.get(code);
        if (!room) return null;
        const player = room.players.find(p => p.id === socketId);
        if (player) player.isReady = ready;
        return room;
    }

    /** Check if all players are ready */
    allReady(code: string): boolean {
        const room = this.rooms.get(code);
        if (!room || room.players.length < 2) return false;
        return room.players.every(p => p.isReady);
    }

    /** Set room status */
    setStatus(code: string, status: Room['status']): void {
        const room = this.rooms.get(code);
        if (room) room.status = status;
    }

    /** Update room rules */
    updateRules(code: string, rules: Partial<RuleConfig>): Room | null {
        const room = this.rooms.get(code);
        if (!room) return null;
        room.rules = { ...room.rules, ...rules };
        return room;
    }

    /** Clean up old rooms (older than 2 hours) */
    cleanup(): void {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        for (const [code, room] of this.rooms) {
            if (room.createdAt < twoHoursAgo) {
                this.rooms.delete(code);
            }
        }
    }
}
