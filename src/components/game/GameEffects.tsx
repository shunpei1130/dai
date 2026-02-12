import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type GameEffect, type GameEffectType, EFFECT_LABELS } from '@/engine/types';

interface GameEffectsProps {
    effects: GameEffect[];
}

// Effect configurations
const EFFECT_CONFIGS: Record<GameEffectType, {
    duration: number;
    bgClass: string;
    textClass: string;
    animation: 'shake' | 'flash' | 'spin' | 'zoom' | 'slide' | 'explode' | 'rain';
    particles?: boolean;
    screenFlash?: string;
}> = {
    revolution: { duration: 2500, bgClass: 'bg-red-900/90', textClass: 'text-red-100', animation: 'shake', screenFlash: 'red', particles: true },
    revolution_cancel: { duration: 2500, bgClass: 'bg-blue-900/90', textClass: 'text-blue-100', animation: 'shake', screenFlash: 'blue', particles: true },
    eight_stop: { duration: 1800, bgClass: 'bg-yellow-900/80', textClass: 'text-yellow-100', animation: 'flash' },
    eleven_back: { duration: 1800, bgClass: 'bg-purple-900/80', textClass: 'text-purple-100', animation: 'spin' },
    suit_lock: { duration: 1500, bgClass: 'bg-amber-900/70', textClass: 'text-amber-100', animation: 'slide' },
    super_lock: { duration: 2000, bgClass: 'bg-orange-900/80', textClass: 'text-orange-100', animation: 'shake', particles: true },
    five_skip: { duration: 1500, bgClass: 'bg-cyan-900/70', textClass: 'text-cyan-100', animation: 'slide' },
    seven_pass: { duration: 1500, bgClass: 'bg-teal-900/70', textClass: 'text-teal-100', animation: 'slide' },
    ten_discard: { duration: 1500, bgClass: 'bg-slate-900/70', textClass: 'text-slate-100', animation: 'slide' },
    spade_three: { duration: 2000, bgClass: 'bg-indigo-900/80', textClass: 'text-indigo-100', animation: 'flash', particles: true },
    nine_reverse: { duration: 1800, bgClass: 'bg-pink-900/80', textClass: 'text-pink-100', animation: 'spin' },
    sandstorm: { duration: 2500, bgClass: 'bg-yellow-800/90', textClass: 'text-yellow-50', animation: 'shake', particles: true, screenFlash: 'yellow' },
    ambulance: { duration: 2000, bgClass: 'bg-red-800/80', textClass: 'text-red-50', animation: 'flash', particles: true },
    q_bomber: { duration: 2500, bgClass: 'bg-orange-900/90', textClass: 'text-orange-50', animation: 'explode', particles: true, screenFlash: 'orange' },
    pile_clear: { duration: 800, bgClass: '', textClass: '', animation: 'slide' },
    player_finish: { duration: 2500, bgClass: 'bg-emerald-900/80', textClass: 'text-emerald-50', animation: 'zoom', particles: true },
    forbidden_finish: { duration: 2500, bgClass: 'bg-red-900/90', textClass: 'text-red-100', animation: 'shake' },
    capital_fall: { duration: 2000, bgClass: 'bg-gray-900/80', textClass: 'text-gray-100', animation: 'rain' },
    gekokujo: { duration: 2500, bgClass: 'bg-amber-900/90', textClass: 'text-amber-50', animation: 'explode', particles: true, screenFlash: 'gold' },
    cataclysm: { duration: 2500, bgClass: 'bg-violet-900/90', textClass: 'text-violet-50', animation: 'shake', particles: true, screenFlash: 'purple' },
    card_exchange: { duration: 1500, bgClass: 'bg-blue-900/70', textClass: 'text-blue-100', animation: 'slide' },
    sequence_revolution: { duration: 2500, bgClass: 'bg-red-900/90', textClass: 'text-red-100', animation: 'shake', screenFlash: 'red', particles: true },
};

// Particle component for effects
const Particles: React.FC<{ color: string; count?: number }> = ({ color, count = 30 }) => {
    const particles = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 12 + 4,
        delay: Math.random() * 0.5,
        duration: Math.random() * 1.5 + 1,
    }));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    initial={{ x: `${p.x}vw`, y: '50vh', scale: 0, opacity: 1 }}
                    animate={{
                        x: `${p.x + (Math.random() - 0.5) * 30}vw`,
                        y: `${p.y}vh`,
                        scale: [0, 1.5, 0],
                        opacity: [0, 1, 0],
                        rotate: Math.random() * 720,
                    }}
                    transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
                    className="absolute rounded-full"
                    style={{
                        width: p.size,
                        height: p.size,
                        backgroundColor: color,
                        boxShadow: `0 0 ${p.size * 2}px ${color}`,
                    }}
                />
            ))}
        </div>
    );
};

// Confetti component for wins
const Confetti: React.FC<{ count?: number }> = ({ count = 50 }) => {
    const confetti = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'][i % 7],
        delay: Math.random() * 0.8,
        duration: Math.random() * 2 + 2,
        size: Math.random() * 10 + 5,
        rotation: Math.random() * 360,
    }));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confetti.map(c => (
                <motion.div
                    key={c.id}
                    initial={{ x: `${c.x}vw`, y: '-5vh', rotate: 0, opacity: 1 }}
                    animate={{
                        y: '105vh',
                        rotate: c.rotation + 720,
                        opacity: [1, 1, 0],
                        x: [`${c.x}vw`, `${c.x + (Math.random() - 0.5) * 20}vw`],
                    }}
                    transition={{ duration: c.duration, delay: c.delay, ease: 'easeIn' }}
                    className="absolute"
                    style={{
                        width: c.size,
                        height: c.size * 0.6,
                        backgroundColor: c.color,
                        borderRadius: '2px',
                    }}
                />
            ))}
        </div>
    );
};

// Lightning effect
const Lightning: React.FC = () => (
    <div className="absolute inset-0 pointer-events-none">
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0, 0.7, 0, 0.4, 0] }}
            transition={{ duration: 0.8, times: [0, 0.1, 0.2, 0.3, 0.5, 0.6, 1] }}
            className="absolute inset-0 bg-white/30"
        />
        {/* Lightning bolt SVG */}
        <motion.svg
            viewBox="0 0 100 200"
            className="absolute left-1/2 top-0 w-32 h-64 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
            transition={{ duration: 0.6 }}
        >
            <motion.path
                d="M50 0 L35 80 L55 75 L40 200 L70 90 L48 95 L65 0Z"
                fill="rgba(255, 255, 100, 0.8)"
                stroke="rgba(255, 220, 0, 1)"
                strokeWidth="2"
            />
        </motion.svg>
    </div>
);

// Screen shake wrapper
const ShakeWrapper: React.FC<{ children: React.ReactNode; active: boolean }> = ({ children, active }) => (
    <motion.div
        animate={active ? {
            x: [0, -8, 8, -6, 6, -3, 3, 0],
            y: [0, 4, -4, 3, -3, 1, -1, 0],
        } : {}}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
        {children}
    </motion.div>
);

// Single effect display
const EffectOverlay: React.FC<{ effect: GameEffect; onComplete: () => void }> = ({ effect, onComplete }) => {
    const config = EFFECT_CONFIGS[effect.type];
    const label = EFFECT_LABELS[effect.type];
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

    useEffect(() => {
        timerRef.current = setTimeout(onComplete, config.duration);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [config.duration, onComplete]);

    // Skip non-visual effects
    if (effect.type === 'pile_clear') return null;

    const isWin = effect.type === 'player_finish' && !!effect.data?.isFirst;
    const isLoss = effect.type === 'player_finish' && !!effect.data?.isLast;

    const getParticleColor = () => {
        switch (effect.type) {
            case 'revolution': case 'revolution_cancel': case 'sequence_revolution': return '#ef4444';
            case 'sandstorm': return '#eab308';
            case 'ambulance': return '#ef4444';
            case 'q_bomber': return '#f97316';
            case 'spade_three': return '#6366f1';
            case 'cataclysm': return '#8b5cf6';
            case 'gekokujo': return '#f59e0b';
            case 'super_lock': return '#f97316';
            default: return '#ffffff';
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Screen flash */}
            {config.screenFlash && (
                <motion.div
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.4, 0] }}
                    transition={{ duration: 0.5 }}
                    style={{
                        background: `radial-gradient(ellipse at center, ${config.screenFlash}, transparent 70%)`,
                    }}
                />
            )}

            {/* Particles */}
            {config.particles && <Particles color={getParticleColor()} />}

            {/* Confetti for wins */}
            {isWin && <Confetti count={60} />}

            {/* Lightning for revolution */}
            {(effect.type === 'revolution' || effect.type === 'sequence_revolution') && <Lightning />}

            {/* Main label */}
            <ShakeWrapper active={config.animation === 'shake'}>
                <motion.div
                    className="relative z-10"
                    initial={
                        config.animation === 'zoom' ? { scale: 0, rotate: -10 } :
                            config.animation === 'spin' ? { rotate: -180, scale: 0 } :
                                config.animation === 'explode' ? { scale: 0 } :
                                    config.animation === 'slide' ? { x: -200, opacity: 0 } :
                                        { scale: 0.5, opacity: 0 }
                    }
                    animate={
                        config.animation === 'zoom' ? { scale: 1, rotate: 0 } :
                            config.animation === 'spin' ? { rotate: 0, scale: 1 } :
                                config.animation === 'explode' ? { scale: [0, 1.3, 1] } :
                                    config.animation === 'slide' ? { x: 0, opacity: 1 } :
                                        { scale: 1, opacity: 1 }
                    }
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                        type: config.animation === 'zoom' ? 'spring' : 'tween',
                        duration: 0.6,
                        bounce: 0.4,
                    }}
                >
                    {/* Effect badge */}
                    <div className={`relative px-12 py-6 rounded-3xl ${config.bgClass} backdrop-blur-xl border border-white/20 shadow-2xl flex flex-col items-center gap-2`}>
                        {/* Glow ring */}
                        <motion.div
                            className="absolute inset-0 rounded-3xl"
                            animate={{
                                boxShadow: [
                                    '0 0 20px rgba(255,255,255,0.1)',
                                    '0 0 60px rgba(255,255,255,0.3)',
                                    '0 0 20px rgba(255,255,255,0.1)',
                                ],
                            }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />

                        {/* Emoji */}
                        <motion.span
                            className="text-6xl"
                            animate={{
                                scale: [1, 1.3, 1],
                                rotate: config.animation === 'spin' ? [0, 360] : [0, 0],
                            }}
                            transition={{ duration: 1, repeat: 1 }}
                        >
                            {String(isWin ? '👑' : isLoss ? '😭' : label.emoji)}
                        </motion.span>

                        {/* Text */}
                        <span className={`text-4xl font-black tracking-wider ${config.textClass} drop-shadow-2xl`}>
                            {isWin ? '大富豪!' : isLoss ? '大貧民...' : label.ja}
                        </span>

                        {/* Sub-text for Q-Bomber */}
                        {effect.type === 'q_bomber' && effect.data?.targetRank && (
                            <motion.span
                                className="text-xl font-bold text-orange-300"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                「{effect.data.targetRank as string}」を爆破!
                            </motion.span>
                        )}

                        {/* Sub-text for skip */}
                        {effect.type === 'five_skip' && effect.data?.count && (
                            <span className="text-lg font-bold text-cyan-300">
                                {effect.data.count as number}人スキップ
                            </span>
                        )}
                    </div>
                </motion.div>
            </ShakeWrapper>
        </motion.div>
    );
};

export const GameEffects: React.FC<GameEffectsProps> = ({ effects }) => {
    const [queue, setQueue] = useState<GameEffect[]>([]);
    const [current, setCurrent] = useState<GameEffect | null>(null);

    useEffect(() => {
        if (effects.length > 0) {
            // Only add effects we haven't seen (by timestamp)
            setQueue(prev => {
                const existingTimestamps = new Set(prev.map(e => e.timestamp));
                const newEffects = effects.filter(e =>
                    !existingTimestamps.has(e.timestamp) && e.type !== 'pile_clear'
                );
                return [...prev, ...newEffects];
            });
        }
    }, [effects]);

    useEffect(() => {
        if (!current && queue.length > 0) {
            setCurrent(queue[0]);
            setQueue(prev => prev.slice(1));
        }
    }, [current, queue]);

    const handleComplete = useCallback(() => {
        setCurrent(null);
    }, []);

    return (
        <AnimatePresence>
            {current && (
                <EffectOverlay
                    key={current.timestamp}
                    effect={current}
                    onComplete={handleComplete}
                />
            )}
        </AnimatePresence>
    );
};
