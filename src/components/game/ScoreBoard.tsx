import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Player, RANK_TITLE_LABELS, RANK_SCORES } from '@/engine/types';

interface ScoreBoardProps {
    players: Player[];
    roundNumber: number;
    onClose: () => void;
    onNextRound: () => void;
}

const rankEmojis: Record<string, string> = {
    daifugo: '👑',
    fugo: '🌟',
    heimin: '🏠',
    hinmin: '📉',
    daihinmin: '💀',
};

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ players, roundNumber, onClose, onNextRound }) => {
    const sorted = [...players].sort((a, b) => b.score - a.score);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.8, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-slate-600 max-w-md w-full shadow-2xl overflow-hidden"
                >
                    {/* Header with animated gradient */}
                    <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-amber-500 p-5 text-center relative overflow-hidden">
                        <motion.div
                            className="absolute inset-0 opacity-30"
                            animate={{
                                background: [
                                    'linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                                    'linear-gradient(45deg, transparent 100%, rgba(255,255,255,0.3) 150%, transparent 200%)',
                                ],
                                backgroundPosition: ['-200% 0', '200% 0'],
                            }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                        <motion.h2
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="text-3xl font-black text-white drop-shadow-lg relative z-10"
                        >
                            🏆 ラウンド {roundNumber} 終了
                        </motion.h2>
                    </div>

                    {/* Rankings with staggered animation */}
                    <div className="p-5 space-y-2">
                        {sorted.map((p, i) => {
                            const rankLabel = p.rankTitle ? RANK_TITLE_LABELS[p.rankTitle] : null;
                            const scoreChange = p.rankTitle ? RANK_SCORES[p.rankTitle] : 0;
                            const medals = ['🥇', '🥈', '🥉'];
                            const emoji = p.rankTitle ? rankEmojis[p.rankTitle] : '';

                            return (
                                <motion.div
                                    key={p.id}
                                    initial={{ opacity: 0, x: -40, scale: 0.9 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    transition={{ delay: 0.3 + i * 0.15, type: 'spring', damping: 15 }}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${i === 0
                                        ? 'bg-yellow-500/20 border border-yellow-500/30 shadow-lg shadow-yellow-500/10'
                                        : i === sorted.length - 1
                                            ? 'bg-red-500/10 border border-red-500/20'
                                            : 'bg-slate-800/50 border border-slate-700/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <motion.span
                                            className="text-2xl w-8 text-center"
                                            initial={{ rotate: -180, scale: 0 }}
                                            animate={{ rotate: 0, scale: 1 }}
                                            transition={{ delay: 0.5 + i * 0.15, type: 'spring' }}
                                        >
                                            {medals[i] || `#${i + 1}`}
                                        </motion.span>
                                        <div>
                                            <div className="text-white font-bold text-sm flex items-center gap-1.5">
                                                {p.name}
                                                {i === 0 && (
                                                    <motion.span
                                                        animate={{ rotate: [0, 10, -10, 0] }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                    >
                                                        {emoji}
                                                    </motion.span>
                                                )}
                                            </div>
                                            {rankLabel && (
                                                <div className={`text-xs font-bold ${p.rankTitle === 'daifugo' ? 'text-yellow-400' :
                                                    p.rankTitle === 'fugo' ? 'text-blue-400' :
                                                        p.rankTitle === 'daihinmin' ? 'text-red-400' :
                                                            p.rankTitle === 'hinmin' ? 'text-orange-400' :
                                                                'text-slate-400'
                                                    }`}>{emoji} {rankLabel.ja}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-white font-bold">{p.score} pt</div>
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.8 + i * 0.15 }}
                                            className={`text-xs font-bold ${scoreChange > 0 ? 'text-green-400' : scoreChange < 0 ? 'text-red-400' : 'text-slate-500'}`}
                                        >
                                            {scoreChange > 0 ? `+${scoreChange}` : scoreChange}
                                        </motion.div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Stats */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2 }}
                        className="px-5 pb-4 flex gap-2 justify-center flex-wrap"
                    >
                        {sorted.filter(p => p.streak > 1).map(p => (
                            <motion.div
                                key={p.id}
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/20"
                            >
                                🔥 {p.name} {p.streak}連勝!
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.5 }}
                        className="flex gap-3 p-5 border-t border-slate-700"
                    >
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
                        >
                            ホームに戻る
                        </button>
                        <button
                            onClick={onNextRound}
                            className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-colors text-lg shadow-lg shadow-green-500/20"
                        >
                            次のラウンド ▶
                        </button>
                    </motion.div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
