import { useState, useEffect, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { GameState } from '@/engine/types';
import type { RuleConfig } from '@/engine/Rules';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export interface RoomPlayer {
    id: string;
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
}

export interface MultiplayerState {
    connected: boolean;
    room: Room | null;
    gameState: GameState | null;
    myPlayerId: string | null;
    error: string | null;
}

export function useMultiplayer() {
    const socketRef = useRef<Socket | null>(null);
    const [state, setState] = useState<MultiplayerState>({
        connected: false,
        room: null,
        gameState: null,
        myPlayerId: null,
        error: null,
    });

    // Connect on mount
    useEffect(() => {
        const socket = io(SERVER_URL, { autoConnect: false });
        socketRef.current = socket;

        socket.on('connect', () => {
            setState(s => ({ ...s, connected: true, error: null }));
        });

        socket.on('disconnect', () => {
            setState(s => ({ ...s, connected: false }));
        });

        socket.on('room-created', (data: { room: Room }) => {
            setState(s => ({ ...s, room: data.room, error: null }));
        });

        socket.on('room-joined', (data: { room: Room }) => {
            setState(s => ({ ...s, room: data.room, error: null }));
        });

        socket.on('room-updated', (data: { room: Room }) => {
            setState(s => ({ ...s, room: data.room }));
        });

        socket.on('game-started', (data: { gameState: GameState; yourPlayerId: string }) => {
            setState(s => ({ ...s, gameState: data.gameState, myPlayerId: data.yourPlayerId }));
        });

        socket.on('game-state-updated', (data: { gameState: GameState }) => {
            setState(s => ({ ...s, gameState: data.gameState }));
        });

        socket.on('error', (data: { message: string }) => {
            setState(s => ({ ...s, error: data.message }));
            setTimeout(() => setState(s => ({ ...s, error: null })), 3000);
        });

        socket.on('player-disconnected', (data: { message: string }) => {
            setState(s => ({ ...s, error: data.message }));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const connect = useCallback(() => {
        socketRef.current?.connect();
    }, []);

    const createRoom = useCallback((playerName: string, rules?: Partial<RuleConfig>) => {
        if (!socketRef.current?.connected) {
            socketRef.current?.connect();
        }
        socketRef.current?.emit('create-room', { playerName, rules });
    }, []);

    const joinRoom = useCallback((roomCode: string, playerName: string) => {
        if (!socketRef.current?.connected) {
            socketRef.current?.connect();
        }
        socketRef.current?.emit('join-room', { roomCode: roomCode.toUpperCase(), playerName });
    }, []);

    const leaveRoom = useCallback(() => {
        socketRef.current?.emit('leave-room');
        setState(s => ({ ...s, room: null, gameState: null, myPlayerId: null }));
    }, []);

    const setReady = useCallback((ready: boolean) => {
        socketRef.current?.emit('set-ready', { ready });
    }, []);

    const updateRules = useCallback((rules: Partial<RuleConfig>) => {
        socketRef.current?.emit('update-rules', { rules });
    }, []);

    const startGame = useCallback(() => {
        socketRef.current?.emit('start-game');
    }, []);

    const playCards = useCallback((cards: any[]) => {
        socketRef.current?.emit('play-cards', { cards });
    }, []);

    const pass = useCallback(() => {
        socketRef.current?.emit('pass');
    }, []);

    const nextRound = useCallback(() => {
        socketRef.current?.emit('next-round');
    }, []);

    return {
        ...state,
        connect,
        createRoom,
        joinRoom,
        leaveRoom,
        setReady,
        updateRules,
        startGame,
        playCards,
        pass,
        nextRound,
    };
}
