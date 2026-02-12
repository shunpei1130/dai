import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type CardDef } from '@/engine/types';
import { PlayingCard } from './Card';
import { cn } from '@/lib/utils'; // Correct import

interface PlayerHandProps {
    cards: CardDef[];
    selectedCardIds: Set<string>;
    onCardClick: (card: CardDef) => void;
    isCurrentTurn: boolean;
    className?: string;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
    cards,
    selectedCardIds,
    onCardClick,
    isCurrentTurn,
    className
}) => {
    return (
        <div className={cn("flex justify-center items-end h-40", className)}>
            <AnimatePresence>
                {cards.map((card, index) => {
                    const isSelected = selectedCardIds.has(card.id);
                    // Calculate overlap
                    // const overlap = index * -40; // Negative margin to overlap

                    return (
                        <motion.div
                            key={card.id}
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -100, opacity: 0, scale: 0.5 }}
                            style={{ marginLeft: index === 0 ? 0 : -40, zIndex: index }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                            <PlayingCard
                                card={card}
                                isSelected={isSelected}
                                onClick={() => isCurrentTurn && onCardClick(card)}
                                className={cn(
                                    "hover:z-50 transition-all duration-200", // Z-index hover effect
                                    !isCurrentTurn && "opacity-80 cursor-not-allowed"
                                )}
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
