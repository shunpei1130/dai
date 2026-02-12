import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { type CardDef } from '@/engine/types';
import { cn } from '@/lib/utils';
import { Club, Diamond, Heart, Spade } from 'lucide-react';

interface CardProps {
    card: CardDef;
    isSelected?: boolean;
    onClick?: () => void;
    className?: string;
    isFaceDown?: boolean;
}

const suitIcons = {
    spades: Spade,
    hearts: Heart,
    diamonds: Diamond,
    clubs: Club,
    joker: () => <span className="text-xl font-bold">🃏</span>,
};

const suitColors = {
    spades: 'text-slate-900',
    hearts: 'text-red-600',
    diamonds: 'text-red-600',
    clubs: 'text-slate-900',
    joker: 'text-transparent bg-clip-text bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500',
};

const suitBgAccents = {
    spades: 'from-slate-100 to-slate-50',
    hearts: 'from-red-50 to-white',
    diamonds: 'from-red-50 to-white',
    clubs: 'from-slate-100 to-slate-50',
    joker: 'from-purple-50 via-pink-50 to-yellow-50',
};

export const PlayingCard: React.FC<CardProps> = ({ card, isSelected, onClick, className, isFaceDown }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [glare, setGlare] = useState({ x: 50, y: 50 });
    const [isHovering, setIsHovering] = useState(false);
    const Icon = suitIcons[card.suit];
    const colorClass = suitColors[card.suit];
    const isJoker = card.suit === 'joker';

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setTilt({
            x: (y - 0.5) * -20,
            y: (x - 0.5) * 20,
        });
        setGlare({ x: x * 100, y: y * 100 });
    };

    const handleMouseLeave = () => {
        setTilt({ x: 0, y: 0 });
        setGlare({ x: 50, y: 50 });
        setIsHovering(false);
    };

    if (isFaceDown) {
        return (
            <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                    "relative w-[72px] h-[100px] rounded-xl border-2 border-white/30 shadow-lg",
                    "bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-900",
                    "flex items-center justify-center",
                    className
                )}
            >
                {/* Inner border pattern */}
                <div className="w-[64px] h-[92px] border border-white/15 rounded-lg flex items-center justify-center relative overflow-hidden">
                    {/* Diamond pattern */}
                    <div className="absolute inset-0 opacity-10">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-6 h-6 border border-white/30 rotate-45"
                                style={{
                                    left: `${(i % 3) * 24 + 4}px`,
                                    top: `${Math.floor(i / 3) * 40 + 10}px`,
                                }}
                            />
                        ))}
                    </div>
                    <div className="text-white/20 text-2xl">♠</div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            ref={cardRef}
            layoutId={card.id}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={handleMouseLeave}
            animate={{
                y: isSelected ? -20 : 0,
                scale: isSelected ? 1.08 : 1,
                rotateX: isHovering ? tilt.x : 0,
                rotateY: isHovering ? tilt.y : 0,
            }}
            whileHover={{ y: -12 }}
            style={{ perspective: 800 }}
            className={cn(
                "relative w-[72px] h-[100px] bg-gradient-to-br rounded-xl border shadow-md cursor-pointer select-none overflow-hidden",
                "flex flex-col items-center justify-between p-1.5",
                suitBgAccents[card.suit],
                isSelected
                    ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-green-900 border-blue-400 shadow-blue-500/30 shadow-lg"
                    : "border-slate-200/80",
                isJoker && "border-purple-300",
                className
            )}
        >
            {/* Glossy shine overlay */}
            {isHovering && (
                <div
                    className="absolute inset-0 z-10 pointer-events-none rounded-xl"
                    style={{
                        background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.35) 0%, transparent 60%)`,
                    }}
                />
            )}

            {/* Joker rainbow border glow */}
            {isJoker && (
                <motion.div
                    className="absolute -inset-0.5 rounded-xl z-0 opacity-60"
                    animate={{
                        background: [
                            'linear-gradient(0deg, #ff0080, #ff8c00, #40e0d0)',
                            'linear-gradient(120deg, #ff8c00, #40e0d0, #ff0080)',
                            'linear-gradient(240deg, #40e0d0, #ff0080, #ff8c00)',
                            'linear-gradient(360deg, #ff0080, #ff8c00, #40e0d0)',
                        ],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
            )}

            {/* Card content */}
            <div className="relative z-[1] w-full h-full flex flex-col items-center justify-between">
                {/* Top left rank + suit */}
                <div className={cn("self-start text-sm font-bold font-mono leading-tight", colorClass)}>
                    <span>{card.rank}</span>
                    <Icon className="w-3 h-3 inline-block ml-0.5" />
                </div>

                {/* Center suit watermark */}
                <div className={cn("absolute inset-0 flex items-center justify-center", isJoker ? "opacity-30" : "opacity-15")}>
                    {isJoker ? (
                        <motion.span
                            className="text-4xl"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        >
                            🃏
                        </motion.span>
                    ) : (
                        <Icon className="w-12 h-12" />
                    )}
                </div>

                {/* Bottom right rank + suit (upside down) */}
                <div className={cn("self-end text-sm font-bold font-mono leading-tight rotate-180", colorClass)}>
                    <span>{card.rank}</span>
                    <Icon className="w-3 h-3 inline-block ml-0.5" />
                </div>
            </div>

            {/* Selected highlight pulse */}
            {isSelected && (
                <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-blue-400/50 z-20 pointer-events-none"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                />
            )}
        </motion.div>
    );
};
