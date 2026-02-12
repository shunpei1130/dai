import React, { useState, useEffect } from 'react';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { type CardDef } from '@/engine/types';
import { PlayingCard } from '@/components/game/Card';
import { PlayerHand } from '@/components/game/PlayerHand';
import { ScoreBoard } from '@/components/game/ScoreBoard';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';

interface OnlineLobbyProps {
    onGoHome: () => void;
}

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onGoHome }) => {
    const mp = useMultiplayer();
    const [playerName, setPlayerName] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    const [showScoreBoard, setShowScoreBoard] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    // Check URL for room code
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('room');
        if (roomCode) {
            setRoomCodeInput(roomCode.toUpperCase());
        }
    }, []);

    // Auto connect
    useEffect(() => {
        mp.connect();
    }, [mp.connect]);

    const showNotif = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 2000);
    };

    // Show errors
    useEffect(() => {
        if (mp.error) showNotif(`❌ ${mp.error}`);
    }, [mp.error]);

    // Round end
    useEffect(() => {
        if (mp.gameState?.phase === 'round_end') {
            setTimeout(() => setShowScoreBoard(true), 1000);
        }
    }, [mp.gameState?.phase]);

    const handleCreateRoom = () => {
        if (!playerName.trim()) { showNotif('名前を入力してください'); return; }
        mp.createRoom(playerName.trim());
    };

    const handleJoinRoom = () => {
        if (!playerName.trim()) { showNotif('名前を入力してください'); return; }
        if (!roomCodeInput.trim()) { showNotif('ルームコードを入力してください'); return; }
        mp.joinRoom(roomCodeInput.trim(), playerName.trim());
    };

    const handlePlay = () => {
        if (!mp.gameState || !mp.myPlayerId) return;
        const myPlayer = mp.gameState.players.find(p => p.id === mp.myPlayerId);
        if (!myPlayer) return;
        const cards = myPlayer.hand.filter(c => selectedCards.has(c.id));
        mp.playCards(cards);
        setSelectedCards(new Set());
    };

    const handlePass = () => {
        mp.pass();
        setSelectedCards(new Set());
    };

    const handleCardClick = (card: CardDef) => {
        setSelectedCards(prev => {
            const next = new Set(prev);
            if (next.has(card.id)) next.delete(card.id);
            else next.add(card.id);
            return next;
        });
    };

    const copyShareLink = () => {
        if (!mp.room) return;
        const url = `${window.location.origin}${window.location.pathname}?room=${mp.room.code}`;
        navigator.clipboard.writeText(url).then(() => showNotif('📋 リンクコピーしました'));
    };

    // === NOT IN ROOM: Show lobby ===
    if (!mp.room) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 to-slate-800 text-white p-4">
                <motion.h2 initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl font-black mb-8">🌐 オンライン対戦</motion.h2>

                <div className="w-full max-w-sm space-y-6">
                    <input
                        type="text"
                        placeholder="あなたの名前"
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value)}
                        maxLength={12}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-center text-lg focus:border-blue-500 focus:outline-none"
                    />

                    <Button onClick={handleCreateRoom} className="w-full py-4 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl">
                        🏠 部屋を作る
                    </Button>

                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-slate-700" />
                        <span className="text-slate-500 text-xs">または</span>
                        <div className="flex-1 h-px bg-slate-700" />
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="ルームコード"
                            value={roomCodeInput}
                            onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                            maxLength={6}
                            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-center text-lg tracking-widest font-mono uppercase focus:border-green-500 focus:outline-none"
                        />
                        <Button onClick={handleJoinRoom} className="py-3 px-6 bg-green-600 hover:bg-green-500 rounded-xl">
                            参加
                        </Button>
                    </div>

                    <button onClick={onGoHome} className="w-full text-slate-500 hover:text-white text-sm py-2 transition-colors">
                        ← ホームに戻る
                    </button>
                </div>

                <div className={`mt-4 text-xs ${mp.connected ? 'text-green-400' : 'text-red-400'}`}>
                    {mp.connected ? '● サーバー接続中' : '○ サーバーに接続中...'}
                </div>

                {notification && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-8 bg-black/90 text-white px-6 py-3 rounded-xl text-sm font-bold">
                        {notification}
                    </motion.div>
                )}
            </div>
        );
    }

    // === IN ROOM, WAITING ===
    if (mp.room.status === 'waiting' || !mp.gameState) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 to-slate-800 text-white p-4">
                <div className="w-full max-w-md space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">🏠 ルーム</h2>
                        <div className="bg-slate-800 border border-slate-600 rounded-xl p-4">
                            <div className="text-3xl font-mono tracking-[0.5em] text-yellow-400 font-black">{mp.room.code}</div>
                            <button onClick={copyShareLink} className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline">
                                🔗 招待リンクをコピー
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm text-slate-400 font-bold">プレイヤー ({mp.room.players.length}/{mp.room.maxPlayers})</h3>
                        {mp.room.players.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-slate-800/50 px-4 py-3 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-bold">{p.name}</span>
                                    {p.isHost && <span className="text-yellow-400 text-xs bg-yellow-400/20 px-2 py-0.5 rounded-full">ホスト</span>}
                                </div>
                                <span className={`text-xs font-bold ${p.isReady ? 'text-green-400' : 'text-slate-500'}`}>
                                    {p.isReady ? '✓ READY' : '待機中'}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={() => mp.setReady(true)} className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl">
                            ✓ 準備完了
                        </Button>
                        <Button onClick={() => { mp.leaveRoom(); onGoHome(); }} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl">
                            退出
                        </Button>
                    </div>

                    {mp.room.players.length >= 2 && (
                        <Button onClick={() => mp.startGame()} className="w-full py-4 text-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 rounded-xl font-black">
                            🎮 ゲーム開始!
                        </Button>
                    )}
                </div>

                {notification && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-8 bg-black/90 text-white px-6 py-3 rounded-xl text-sm font-bold">
                        {notification}
                    </motion.div>
                )}
            </div>
        );
    }

    // === IN GAME ===
    const gs = mp.gameState;
    const myPlayer = gs.players.find(p => p.id === mp.myPlayerId);
    const opponents = gs.players.filter(p => p.id !== mp.myPlayerId);
    const isMyTurn = gs.currentTurn === mp.myPlayerId;

    if (!myPlayer) return null;

    return (
        <div className="w-full h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 relative overflow-hidden flex flex-col justify-between p-4">
            {/* Top bar */}
            <div className="absolute top-2 left-2 z-20 flex gap-2 items-center">
                <div className="text-white/60 text-xs bg-black/30 px-3 py-1.5 rounded-lg">
                    🌐 {mp.room.code} | R{gs.roundNumber}
                </div>
            </div>

            {/* Status badges */}
            <div className="absolute top-2 right-2 z-20 flex gap-2 flex-wrap">
                {(gs.isRevolution !== gs.isElevenBack) && (
                    <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">⚡ 革命</div>
                )}
                {gs.suitLock.active && (
                    <div className="bg-yellow-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">🔒 縛り</div>
                )}
            </div>

            {/* Opponents */}
            <div className="flex justify-around items-start mt-8">
                {opponents.map(p => (
                    <div key={p.id} className="flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-full bg-slate-700 border-2 ${gs.currentTurn === p.id ? 'border-yellow-400 animate-pulse' : 'border-slate-500'
                            } flex items-center justify-center text-white font-bold text-xs`}>
                            {p.name}
                        </div>
                        <div className="mt-1 text-white text-xs bg-black/40 px-2 py-0.5 rounded-full">{p.hand.length}枚</div>
                        {p.hasPassed && <div className="text-gray-400 text-xs font-bold">PASS</div>}
                    </div>
                ))}
            </div>

            {/* Pile */}
            <div className="flex-1 flex items-center justify-center relative">
                <AnimatePresence>
                    {gs.pile.length > 0 ? (
                        <div className="relative flex items-center justify-center">
                            {gs.pile[gs.pile.length - 1].cards.map((card, i) => (
                                <motion.div key={card.id} initial={{ scale: 0.5, opacity: 0, y: -50 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                                    className="absolute" style={{ left: (i - (gs.pile[gs.pile.length - 1].cards.length - 1) / 2) * 25 }}>
                                    <PlayingCard card={card} className="shadow-2xl" />
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-white/20 text-2xl font-bold border-2 border-dashed border-white/20 px-12 py-8 rounded-xl">
                            カードを出す
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Notification */}
            <AnimatePresence>
                {notification && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-black/90 text-white text-xl font-black px-8 py-4 rounded-2xl shadow-2xl">
                        {notification}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Player controls */}
            <div className="flex flex-col items-center mb-2">
                <div className="flex gap-3 mb-3">
                    <Button onClick={handlePlay} disabled={!isMyTurn || selectedCards.size === 0}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 shadow-lg text-white font-bold px-6">出す</Button>
                    <Button onClick={handlePass} disabled={!isMyTurn}
                        className="bg-red-600 hover:bg-red-500 disabled:bg-slate-700 shadow-lg text-white font-bold px-6">パス</Button>
                </div>

                <PlayerHand cards={myPlayer.hand} selectedCardIds={selectedCards} onCardClick={handleCardClick} isCurrentTurn={isMyTurn} />
                <div className="text-white text-sm font-bold mt-1 flex items-center gap-2">
                    <span>{myPlayer.name}</span>
                    {isMyTurn && <span className="text-yellow-400 animate-pulse">(あなたのターン)</span>}
                </div>
            </div>

            {/* Scoreboard */}
            {showScoreBoard && gs.phase === 'round_end' && (
                <ScoreBoard players={gs.players} roundNumber={gs.roundNumber}
                    onClose={() => { mp.leaveRoom(); onGoHome(); }}
                    onNextRound={() => { mp.nextRound(); setShowScoreBoard(false); setSelectedCards(new Set()); }}
                />
            )}
        </div>
    );
};
