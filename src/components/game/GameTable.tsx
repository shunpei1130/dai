import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from '@/engine/Game';
import { CPUEngine } from '@/engine/CPU';
import { type CardDef, type GameState, type MatchResult, RANK_SCORES, RANK_TITLE_LABELS } from '@/engine/types';
import { type RuleConfig } from '@/engine/Rules';
import { MatchTracker } from '@/engine/MatchTracker';
import { PlayingCard } from './Card';
import { PlayerHand } from './PlayerHand';
import { ScoreBoard } from './ScoreBoard';
import { GameEffects } from './GameEffects';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';

interface GameTableProps {
    rules: RuleConfig;
    onGoHome: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({ rules, onGoHome }) => {
    const engineRef = useRef<GameEngine>(new GameEngine(rules));
    const cpuEnginesRef = useRef<CPUEngine[]>([]);
    const matchTrackerRef = useRef<MatchTracker>(new MatchTracker());
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    const [showScoreBoard, setShowScoreBoard] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    // Initialize game
    useEffect(() => {
        const engine = engineRef.current;
        engine.setRules(rules);
        const state = engine.initGame(['You', 'CPU 1', 'CPU 2', 'CPU 3']);

        // Create CPU engines
        cpuEnginesRef.current = state.players
            .filter(p => p.isCpu)
            .map(p => new CPUEngine(engine, p.id));

        // Auto card exchange for first round
        if (state.phase === 'card_exchange') {
            const newState = engine.autoCardExchange();
            setGameState(newState);
        } else {
            setGameState(state);
        }
    }, [rules]);

    // Show notification
    const showNotif = useCallback((msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 2000);
    }, []);

    // CPU turn handler
    useEffect(() => {
        if (!gameState) return;
        if (gameState.phase !== 'playing') return;

        const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn);
        if (!currentPlayer?.isCpu) return;

        const timeout = setTimeout(() => {
            const engine = engineRef.current;
            const cpuEngine = cpuEnginesRef.current.find(_c => {
                const state = engine.getState();
                return state.currentTurn === currentPlayer.id;
            });

            if (!cpuEngine) return;

            try {
                // Handle pending actions first
                if (gameState.pendingActionPlayerId === currentPlayer.id) {
                    if (gameState.pendingGiveCards > 0) {
                        const cards = cpuEngine.decideGiveCards(gameState.pendingGiveCards);
                        const newState = engine.giveCards(currentPlayer.id, cards);
                        setGameState(newState);
                        return;
                    }
                    if (gameState.pendingDiscardCount > 0) {
                        const cards = cpuEngine.decideDiscardCards(gameState.pendingDiscardCount);
                        const newState = engine.discardCards(currentPlayer.id, cards);
                        setGameState(newState);
                        return;
                    }
                }

                const move = cpuEngine.decideMove();
                if (move) {
                    const newState = engine.playCards(currentPlayer.id, move);
                    setGameState(newState);
                } else {
                    const newState = engine.pass(currentPlayer.id);
                    setGameState(newState);
                }
            } catch {
                try {
                    const newState = engine.pass(currentPlayer.id);
                    setGameState(newState);
                } catch { /* game might be over */ }
            }
        }, 1000);

        return () => clearTimeout(timeout);
    }, [gameState, showNotif]);

    // Show scoreboard when round ends
    useEffect(() => {
        if (!gameState) return;
        if (gameState.phase === 'round_end') {
            const result: MatchResult = {
                roundNumber: gameState.roundNumber,
                rankings: gameState.players.map(p => ({
                    playerId: p.id,
                    playerName: p.name,
                    rankTitle: p.rankTitle || 'heimin',
                    score: p.rankTitle ? RANK_SCORES[p.rankTitle] : 0,
                })),
                timestamp: Date.now(),
            };
            matchTrackerRef.current.recordRound(result);

            // Delay scoreboard to let final effects play
            setTimeout(() => setShowScoreBoard(true), 2500);
        }
    }, [gameState?.phase]);

    const handleCardClick = (card: CardDef) => {
        setSelectedCards(prev => {
            const next = new Set(prev);
            if (next.has(card.id)) {
                next.delete(card.id);
            } else {
                next.add(card.id);
            }
            return next;
        });
    };

    const handlePlay = () => {
        if (!gameState) return;
        const engine = engineRef.current;
        const cards = gameState.players[0].hand.filter(c => selectedCards.has(c.id));
        if (cards.length === 0) return;

        try {
            const newState = engine.playCards(gameState.players[0].id, cards);
            setGameState(newState);
            setSelectedCards(new Set());
        } catch (e: unknown) {
            showNotif(`❌ ${e instanceof Error ? e.message : '出せません'}`);
        }
    };

    const handlePass = () => {
        if (!gameState) return;
        const engine = engineRef.current;
        try {
            const newState = engine.pass(gameState.players[0].id);
            setGameState(newState);
            setSelectedCards(new Set());
        } catch {
            showNotif('パスできません');
        }
    };

    const handleNextRound = () => {
        const engine = engineRef.current;
        const newState = engine.startNewRound();

        cpuEnginesRef.current = newState.players
            .filter(p => p.isCpu)
            .map(p => new CPUEngine(engine, p.id));

        if (newState.phase === 'card_exchange') {
            const exchangedState = engine.autoCardExchange();
            setGameState(exchangedState);
        } else {
            setGameState(newState);
        }

        setShowScoreBoard(false);
        setSelectedCards(new Set());
    };

    if (!gameState) return <div className="flex items-center justify-center h-screen text-white text-2xl">Loading...</div>;

    const humanPlayer = gameState.players[0];
    const opponents = gameState.players.slice(1);
    const isMyTurn = gameState.currentTurn === humanPlayer.id;
    const effectiveRevolution = gameState.isRevolution !== gameState.isElevenBack;

    return (
        <div className="w-full h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 relative overflow-hidden flex flex-col justify-between p-3">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.05) 35px, rgba(255,255,255,0.05) 70px)`,
                }} />
            </div>

            {/* Game Effects Overlay */}
            <GameEffects effects={gameState.effectQueue} />

            {/* Top Bar */}
            <div className="absolute top-2 left-2 z-20 flex gap-2 items-center">
                <button onClick={onGoHome} className="text-white/60 hover:text-white text-xs bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-lg transition-all backdrop-blur-sm">
                    ← ホーム
                </button>
                <div className="text-white/70 text-xs bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-sm font-bold">
                    R{gameState.roundNumber}
                </div>
            </div>

            {/* Q-Bomber Selector */}
            {isMyTurn && gameState.pendingActionPlayerId === humanPlayer.id &&
                gameState.pendingGiveCards === 0 && gameState.pendingDiscardCount === 0 && (
                    <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-800 border border-slate-600 p-6 rounded-2xl max-w-lg w-full"
                        >
                            <h3 className="text-xl text-white font-bold text-center mb-4">💣 12ボンバー! 指定する番号を選んでください</h3>
                            <div className="grid grid-cols-5 gap-2">
                                {['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'].map(rank => (
                                    <button
                                        key={rank}
                                        onClick={() => {
                                            const engine = engineRef.current;
                                            engine.executeQBomber(humanPlayer.id, rank as any, true);
                                            setGameState({ ...engine.getState() });
                                        }}
                                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg border border-slate-500 transition-colors"
                                    >
                                        {rank}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}

            {/* Status Indicators */}
            <div className="absolute top-2 right-2 z-20 flex gap-1.5 flex-wrap max-w-xs">
                {effectiveRevolution && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="bg-gradient-to-r from-red-600 to-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-red-500/30"
                    >
                        <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                            ⚡ 革命
                        </motion.span>
                    </motion.div>
                )}
                {gameState.isElevenBack && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-gradient-to-r from-purple-600 to-purple-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                        🔄 11バック
                    </motion.div>
                )}
                {gameState.suitLock.active && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                        {gameState.suitLock.lastRank !== undefined ? '🔒🔒 激縛り' : '🔒 縛り'}
                    </motion.div>
                )}
                {gameState.turnDirection === -1 && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-gradient-to-r from-pink-600 to-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                        <motion.span animate={{ rotate: [0, -360] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>↺</motion.span> リバース
                    </motion.div>
                )}
            </div>

            {/* Opponents Area */}
            <div className="flex justify-around items-start mt-8 relative z-10">
                {opponents.map((p, idx) => {
                    const rankLabel = p.rankTitle ? RANK_TITLE_LABELS[p.rankTitle] : null;
                    const isCurrent = gameState.currentTurn === p.id;
                    const hasFinished = p.hand.length === 0 && p.rank;

                    return (
                        <motion.div
                            key={p.id}
                            className="flex flex-col items-center"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            {/* Player avatar */}
                            <div className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center text-white font-bold text-xs transition-all
                                ${isCurrent ? 'border-yellow-400 shadow-lg shadow-yellow-400/40 bg-gradient-to-br from-slate-600 to-slate-700' :
                                    hasFinished ? 'border-green-500 bg-gradient-to-br from-green-900 to-green-800 opacity-60' :
                                        'border-slate-500 bg-gradient-to-br from-slate-700 to-slate-800'}`}
                            >
                                {/* Turn indicator ring */}
                                {isCurrent && (
                                    <motion.div
                                        className="absolute -inset-1 rounded-full border-2 border-yellow-400/50"
                                        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />
                                )}
                                {hasFinished ? (
                                    <span className="text-lg">{p.rank === 1 ? '👑' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : '✓'}</span>
                                ) : (
                                    <span>{p.name}</span>
                                )}

                                {/* Rank badge */}
                                {p.rank && !hasFinished && (
                                    <div className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded-full border border-white">
                                        #{p.rank}
                                    </div>
                                )}
                            </div>

                            {/* Card count */}
                            <div className="mt-1 text-white text-[10px] bg-black/50 px-2 py-0.5 rounded-full font-bold backdrop-blur-sm">
                                {p.hand.length}枚
                            </div>

                            {/* Pass indicator */}
                            {p.hasPassed && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="text-red-400 text-[10px] font-bold bg-red-400/10 px-2 py-0.5 rounded-full mt-0.5"
                                >
                                    PASS
                                </motion.div>
                            )}

                            {/* Rank title */}
                            {rankLabel && (
                                <div className={`text-[9px] font-bold mt-0.5 ${p.rankTitle === 'daifugo' ? 'text-yellow-400' : p.rankTitle === 'daihinmin' ? 'text-red-400' : 'text-slate-400'}`}>
                                    {rankLabel.ja}
                                </div>
                            )}
                            <div className="text-slate-500 text-[9px]">{p.score}pt</div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Center Pile */}
            <div className="flex-1 flex items-center justify-center relative z-10">
                <AnimatePresence mode="wait">
                    {gameState.pile.length > 0 && (
                        <div className="relative flex items-center justify-center">
                            {gameState.pile[gameState.pile.length - 1].cards.map((card, i) => (
                                <motion.div
                                    key={card.id}
                                    initial={{ scale: 0.3, opacity: 0, y: -80, rotate: -20 }}
                                    animate={{
                                        scale: 1,
                                        opacity: 1,
                                        y: 0,
                                        rotate: (Math.random() - 0.5) * 8,
                                    }}
                                    exit={{ scale: 0, opacity: 0, y: 30, rotate: 20 }}
                                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                                    className="absolute"
                                    style={{
                                        left: (i - (gameState.pile[gameState.pile.length - 1].cards.length - 1) / 2) * 30,
                                        top: 0,
                                        zIndex: i,
                                    }}
                                >
                                    <PlayingCard card={card} className="shadow-2xl" />
                                </motion.div>
                            ))}
                        </div>
                    )}
                    {gameState.pile.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-white/15 text-xl font-bold border-2 border-dashed border-white/15 px-10 py-6 rounded-2xl"
                        >
                            カードを出す
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Pile card count */}
                {gameState.pile.length > 0 && (
                    <div className="absolute bottom-0 right-[calc(50%-60px)] text-white/30 text-[10px] bg-black/30 px-2 py-0.5 rounded-full">
                        積{gameState.pile.length}
                    </div>
                )}
            </div>

            {/* Notification (legacy, complementing GameEffects) */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ y: 50, opacity: 0, scale: 0.8 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-black/90 text-white text-lg font-black px-6 py-3 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm"
                    >
                        {notification}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Player Area */}
            <div className="flex flex-col items-center mb-1 relative z-10">
                {/* Action buttons */}
                <div className="flex gap-2 mb-2">
                    {/* Dynamic Action Button */}
                    {isMyTurn && gameState.pendingActionPlayerId === humanPlayer.id ? (
                        <Button
                            onClick={() => {
                                if (gameState.pendingGiveCards > 0) {
                                    if (selectedCards.size !== gameState.pendingGiveCards) {
                                        showNotif(`${gameState.pendingGiveCards}枚選んでください`);
                                        return;
                                    }
                                    const engine = engineRef.current;
                                    const cards = humanPlayer.hand.filter(c => selectedCards.has(c.id));
                                    try {
                                        const newState = engine.giveCards(humanPlayer.id, cards);
                                        setGameState(newState);
                                        setSelectedCards(new Set());
                                    } catch (e) {
                                        showNotif('カードを渡せません');
                                    }
                                } else if (gameState.pendingDiscardCount > 0) {
                                    if (selectedCards.size !== gameState.pendingDiscardCount) {
                                        showNotif(`${gameState.pendingDiscardCount}枚選んでください`);
                                        return;
                                    }
                                    const engine = engineRef.current;
                                    const cards = humanPlayer.hand.filter(c => selectedCards.has(c.id));
                                    try {
                                        const newState = engine.discardCards(humanPlayer.id, cards);
                                        setGameState(newState);
                                        setSelectedCards(new Set());
                                    } catch (e) {
                                        showNotif('カードを捨てられません');
                                    }
                                }
                            }}
                            disabled={
                                (gameState.pendingGiveCards > 0 && selectedCards.size !== gameState.pendingGiveCards) ||
                                (gameState.pendingDiscardCount > 0 && selectedCards.size !== gameState.pendingDiscardCount)
                            }
                            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-lg text-white font-bold px-5 text-sm transition-all"
                        >
                            {gameState.pendingGiveCards > 0
                                ? `${gameState.pendingGiveCards}枚渡す`
                                : `${gameState.pendingDiscardCount}枚捨てる`}
                        </Button>
                    ) : (
                        <>
                            <Button
                                onClick={handlePlay}
                                disabled={!isMyTurn || selectedCards.size === 0 || !!gameState.pendingActionPlayerId}
                                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 shadow-lg text-white font-bold px-5 text-sm transition-all"
                            >
                                出す
                            </Button>
                            <Button
                                onClick={handlePass}
                                disabled={!isMyTurn || !!gameState.pendingActionPlayerId}
                                className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-slate-700 disabled:to-slate-700 shadow-lg text-white font-bold px-5 text-sm transition-all"
                            >
                                パス
                            </Button>
                        </>
                    )}
                </div>

                {/* Hand area */}
                <div className="relative">
                    {humanPlayer.hasPassed && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-xl text-white font-bold text-lg backdrop-blur-sm">
                            <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
                                パス
                            </motion.span>
                        </div>
                    )}
                    <PlayerHand
                        cards={humanPlayer.hand}
                        selectedCardIds={selectedCards}
                        onCardClick={handleCardClick}
                        isCurrentTurn={isMyTurn}
                    />
                </div>

                {/* Player info */}
                <div className="text-white text-xs font-bold mt-1 flex items-center gap-2">
                    <span>{humanPlayer.name}</span>
                    <span className="text-slate-400 text-[10px]">{humanPlayer.score}pt</span>
                    {isMyTurn && (
                        <motion.span
                            className="text-yellow-400"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        >
                            {gameState.pendingGiveCards > 0
                                ? `(${gameState.pendingGiveCards}枚渡して!)`
                                : gameState.pendingDiscardCount > 0
                                    ? `(${gameState.pendingDiscardCount}枚捨てて!)`
                                    : (gameState.pendingActionPlayerId === humanPlayer.id)
                                        ? '(12ボンバー!)'
                                        : '(あなたのターン)'}
                        </motion.span>
                    )}
                </div>
            </div>

            {/* Score Board Overlay */}
            {
                showScoreBoard && gameState.phase === 'round_end' && (
                    <ScoreBoard
                        players={gameState.players}
                        roundNumber={gameState.roundNumber}
                        onClose={onGoHome}
                        onNextRound={handleNextRound}
                    />
                )
            }
        </div >
    );
};
