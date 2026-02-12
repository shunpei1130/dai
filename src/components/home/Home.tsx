import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface HomeProps {
    onStartLocal: () => void;
    onStartOnline: () => void;
    onOpenSettings: () => void;
}

export const Home: React.FC<HomeProps> = ({ onStartLocal, onStartOnline, onOpenSettings }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white relative overflow-hidden">
            {/* Animated Background Particles */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute bg-white/5 rounded-full"
                        animate={{
                            y: [0, -200],
                            opacity: [0, 0.3, 0],
                        }}
                        transition={{
                            duration: 8 + Math.random() * 8,
                            repeat: Infinity,
                            delay: Math.random() * 5,
                            ease: 'linear',
                        }}
                        style={{
                            left: `${Math.random() * 100}%`,
                            bottom: `-${Math.random() * 20}%`,
                            width: 100 + Math.random() * 200,
                            height: 100 + Math.random() * 200,
                        }}
                    />
                ))}
            </div>

            {/* Card decorations */}
            <motion.div
                className="absolute top-10 left-10 text-6xl opacity-10"
                animate={{ rotate: [0, 15, -5, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
            >♠</motion.div>
            <motion.div
                className="absolute top-20 right-16 text-5xl opacity-10"
                animate={{ rotate: [0, -10, 5, 0] }}
                transition={{ duration: 7, repeat: Infinity }}
            >♥</motion.div>
            <motion.div
                className="absolute bottom-20 left-20 text-4xl opacity-10"
                animate={{ rotate: [0, 10, -15, 0] }}
                transition={{ duration: 8, repeat: Infinity }}
            >♦</motion.div>
            <motion.div
                className="absolute bottom-16 right-10 text-5xl opacity-10"
                animate={{ rotate: [0, -5, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity }}
            >♣</motion.div>

            <div className="z-10 text-center space-y-8 px-4">
                {/* Title */}
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                >
                    <h1 className="text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 drop-shadow-lg">
                        大富豪
                    </h1>
                    <p className="text-lg text-slate-400 mt-2 font-medium tracking-wide">
                        DAIFUGO - The Ultimate Card Game
                    </p>
                </motion.div>

                {/* Menu Buttons */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-4 max-w-xs mx-auto"
                >
                    <Button
                        onClick={onStartLocal}
                        size="lg"
                        className="w-full text-lg py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl hover:shadow-2xl transition-all hover:scale-105 rounded-xl"
                    >
                        🎮 ひとりプレイ
                    </Button>
                    <Button
                        onClick={onStartOnline}
                        size="lg"
                        className="w-full text-lg py-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-xl hover:shadow-2xl transition-all hover:scale-105 rounded-xl"
                    >
                        🌐 オンライン対戦
                    </Button>
                    <Button
                        onClick={onOpenSettings}
                        size="lg"
                        className="w-full text-lg py-6 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 shadow-xl hover:shadow-2xl transition-all hover:scale-105 rounded-xl"
                    >
                        ⚙️ ルール設定
                    </Button>
                </motion.div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-xs text-slate-600 mt-8"
                >
                    15種類のルールバリエーション対応
                </motion.div>
            </div>
        </div>
    );
};
