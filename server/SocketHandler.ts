import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { GameEngine } from '../src/engine/Game';
import { type CardDef } from '../src/engine/types';
import { CPUEngine } from '../src/engine/CPU';

interface ServerGames {
    [roomCode: string]: {
        engine: GameEngine;
        cpuEngines: CPUEngine[];
    };
}

export class SocketHandler {
    private io: Server;
    private roomManager: RoomManager;
    private games: ServerGames = {};

    constructor(io: Server, roomManager: RoomManager) {
        this.io = io;
        this.roomManager = roomManager;
        this.setupHandlers();

        // Cleanup old rooms every 30 minutes
        setInterval(() => this.roomManager.cleanup(), 30 * 60 * 1000);
    }

    private setupHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Player connected: ${socket.id}`);

            socket.on('create-room', (data: { playerName: string; rules?: any }) => {
                this.handleCreateRoom(socket, data);
            });

            socket.on('join-room', (data: { roomCode: string; playerName: string }) => {
                this.handleJoinRoom(socket, data);
            });

            socket.on('leave-room', () => {
                this.handleLeaveRoom(socket);
            });

            socket.on('set-ready', (data: { ready: boolean }) => {
                this.handleSetReady(socket, data);
            });

            socket.on('update-rules', (data: { rules: any }) => {
                this.handleUpdateRules(socket, data);
            });

            socket.on('start-game', () => {
                this.handleStartGame(socket);
            });

            socket.on('play-cards', (data: { cards: CardDef[] }) => {
                this.handlePlayCards(socket, data);
            });

            socket.on('pass', () => {
                this.handlePass(socket);
            });

            socket.on('next-round', () => {
                this.handleNextRound(socket);
            });

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    private handleCreateRoom(socket: Socket, data: { playerName: string; rules?: any }): void {
        const room = this.roomManager.createRoom(socket.id, data.playerName, data.rules);
        socket.join(room.code);
        socket.emit('room-created', { room });
        console.log(`Room created: ${room.code} by ${data.playerName}`);
    }

    private handleJoinRoom(socket: Socket, data: { roomCode: string; playerName: string }): void {
        const room = this.roomManager.joinRoom(data.roomCode, socket.id, data.playerName);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つからないか、満員です' });
            return;
        }
        socket.join(room.code);
        socket.emit('room-joined', { room });
        this.io.to(room.code).emit('room-updated', { room });
        console.log(`${data.playerName} joined room ${room.code}`);
    }

    private handleLeaveRoom(socket: Socket): void {
        const room = this.roomManager.getRoomByPlayerId(socket.id);
        if (!room) return;

        const updatedRoom = this.roomManager.leaveRoom(room.code, socket.id);
        socket.leave(room.code);

        if (updatedRoom) {
            this.io.to(room.code).emit('room-updated', { room: updatedRoom });
        }
    }

    private handleSetReady(socket: Socket, data: { ready: boolean }): void {
        const room = this.roomManager.getRoomByPlayerId(socket.id);
        if (!room) return;

        const updatedRoom = this.roomManager.setReady(room.code, socket.id, data.ready);
        if (updatedRoom) {
            this.io.to(room.code).emit('room-updated', { room: updatedRoom });
        }
    }

    private handleUpdateRules(socket: Socket, data: { rules: any }): void {
        const room = this.roomManager.getRoomByPlayerId(socket.id);
        if (!room || room.hostId !== socket.id) return;

        const updatedRoom = this.roomManager.updateRules(room.code, data.rules);
        if (updatedRoom) {
            this.io.to(room.code).emit('room-updated', { room: updatedRoom });
        }
    }

    private handleStartGame(socket: Socket): void {
        const room = this.roomManager.getRoomByPlayerId(socket.id);
        if (!room || room.hostId !== socket.id) return;
        if (room.players.length < 2) {
            socket.emit('error', { message: '2人以上のプレイヤーが必要です' });
            return;
        }

        this.roomManager.setStatus(room.code, 'playing');

        // Create game engine
        const engine = new GameEngine(room.rules);
        const playerNames = room.players.map(p => p.name);
        const gameState = engine.initGame(playerNames);

        // Map socket IDs to player IDs
        const playerMapping = room.players.map((rp, i) => ({
            socketId: rp.id,
            playerId: `player-${i}`,
            playerName: rp.name,
        }));

        this.games[room.code] = { engine, cpuEngines: [] };

        // Send game state to each player with their perspective
        for (const pm of playerMapping) {
            const sock = this.io.sockets.sockets.get(pm.socketId);
            if (sock) {
                sock.emit('game-started', {
                    gameState,
                    yourPlayerId: pm.playerId,
                    playerMapping,
                });
            }
        }
    }

    private handlePlayCards(socket: Socket, data: { cards: CardDef[] }): void {
        const room = this.roomManager.getRoomByPlayerId(socket.id);
        if (!room || !this.games[room.code]) return;

        const { engine } = this.games[room.code];
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        const playerId = `player-${playerIndex}`;

        try {
            const newState = engine.playCards(playerId, data.cards);
            this.io.to(room.code).emit('game-state-updated', { gameState: newState });

            if (newState.phase === 'round_end') {
                this.roomManager.setStatus(room.code, 'finished');
            }
        } catch (e: any) {
            socket.emit('error', { message: e.message });
        }
    }

    private handlePass(socket: Socket): void {
        const room = this.roomManager.getRoomByPlayerId(socket.id);
        if (!room || !this.games[room.code]) return;

        const { engine } = this.games[room.code];
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        const playerId = `player-${playerIndex}`;

        try {
            const newState = engine.pass(playerId);
            this.io.to(room.code).emit('game-state-updated', { gameState: newState });
        } catch (e: any) {
            socket.emit('error', { message: e.message });
        }
    }

    private handleNextRound(socket: Socket): void {
        const room = this.roomManager.getRoomByPlayerId(socket.id);
        if (!room || !this.games[room.code]) return;

        const { engine } = this.games[room.code];

        try {
            const newState = engine.startNewRound();
            this.roomManager.setStatus(room.code, 'playing');

            // Auto card exchange if applicable
            if (newState.phase === 'card_exchange') {
                const exchangedState = engine.autoCardExchange();
                this.io.to(room.code).emit('game-state-updated', { gameState: exchangedState });
            } else {
                this.io.to(room.code).emit('game-state-updated', { gameState: newState });
            }
        } catch (e: any) {
            socket.emit('error', { message: e.message });
        }
    }

    private handleDisconnect(socket: Socket): void {
        console.log(`Player disconnected: ${socket.id}`);
        const room = this.roomManager.getRoomByPlayerId(socket.id);
        if (!room) return;

        const updatedRoom = this.roomManager.leaveRoom(room.code, socket.id);
        if (updatedRoom) {
            this.io.to(room.code).emit('room-updated', { room: updatedRoom });
            this.io.to(room.code).emit('player-disconnected', {
                message: 'プレイヤーが切断しました',
            });
        }

        // Clean up game if empty
        if (!updatedRoom && this.games[room.code]) {
            delete this.games[room.code];
        }
    }
}
