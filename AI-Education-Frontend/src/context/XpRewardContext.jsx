import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playFanfareChime } from '../shared/notificationSound';

const XpRewardContext = createContext({
  userXp: 350,
  streakShield: true,
  awardXp: () => {},
});

export const XpRewardProvider = ({ children }) => {
  const [userXp, setUserXp] = useState(() => {
    try {
      const saved = localStorage.getItem('eduai_user_xp');
      return saved != null ? parseInt(saved, 10) : 350;
    } catch {
      return 350;
    }
  });

  const [streakShield, setStreakShield] = useState(() => {
    try {
      const saved = localStorage.getItem('eduai_streak_shield');
      return saved !== 'inactive';
    } catch {
      return true;
    }
  });

  const [activeRewards, setActiveRewards] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem('eduai_user_xp', userXp.toString());
    } catch {}
  }, [userXp]);

  useEffect(() => {
    try {
      localStorage.setItem('eduai_streak_shield', streakShield ? 'active' : 'inactive');
    } catch {}
  }, [streakShield]);

  const awardXp = (amount = 50, reason = 'Great job!', options = {}) => {
    const gainedXp = Math.max(10, amount);
    setUserXp((prev) => prev + gainedXp);

    if (options.streakShield) {
      setStreakShield(true);
    }

    const id = Date.now();
    const newReward = {
      id,
      amount: gainedXp,
      reason,
      streakShield: options.streakShield || false,
    };

    setActiveRewards((prev) => [...prev, newReward]);
    playFanfareChime();

    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setActiveRewards((prev) => prev.filter((r) => r.id !== id));
    }, 4000);
  };

  return (
    <XpRewardContext.Provider value={{ userXp, streakShield, awardXp }}>
      {children}

      {/* Floating Animated XP Reward Toasts Container */}
      <div className="fixed top-20 right-4 z-50 pointer-events-none flex flex-col items-end gap-2.5 max-w-sm w-full">
        <AnimatePresence>
          {activeRewards.map((reward) => (
            <motion.div
              key={reward.id}
              initial={{ opacity: 0, y: -20, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="pointer-events-auto bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3.5 rounded-2xl shadow-xl border border-amber-300/40 flex items-center gap-3.5 backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner">
                ⭐
              </div>
              <div className="flex flex-col leading-tight min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white drop-shadow-xs">
                    +{reward.amount} XP
                  </span>
                  {reward.streakShield && (
                    <span className="text-[10px] bg-white/30 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                      🛡️ Shield Saved
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-amber-50 truncate">{reward.reason}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </XpRewardContext.Provider>
  );
};

export const useXpReward = () => useContext(XpRewardContext);
export default XpRewardContext;
