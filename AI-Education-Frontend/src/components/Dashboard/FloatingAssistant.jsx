import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const FloatingAssistant = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end">
      {/* Tooltip on Hover: Ask EduAI */}
      <AnimatePresence>
        {isHovered && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="mb-2 px-3 py-1.5 bg-[#123B35] text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 z-50 pointer-events-none"
          >
            <span>Ask StudySpace</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating AI Button */}
      <motion.button
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-[#123B35] text-white shadow-2xl flex items-center justify-center cursor-pointer border-2 border-white/40 focus:outline-none focus:ring-4 focus:ring-[#168A78]/40"
        title="Ask StudySpace"
        aria-label="Ask StudySpace"
      >
        <span className="material-symbols-outlined text-2xl text-[#D9A441]">smart_toy</span>
      </motion.button>

      {/* Floating Chat Drawer / Panel */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white dark:bg-[#152238] h-full shadow-2xl flex flex-col z-10 border-l border-[#E6E0D5] dark:border-slate-800"
            >
              <div className="p-5 border-b border-[#E6E0D5] dark:border-slate-800 flex items-center justify-between bg-[#F7F3EA] dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#123B35] text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px] text-[#D9A441]">smart_toy</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#17212B] dark:text-white">StudySpace Assistant</h3>
                    <span className="text-xs font-bold text-[#168A78] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#168A78] inline-block animate-pulse" />
                      Ready to assist
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="material-symbols-outlined text-[#68737A] hover:text-[#17212B] dark:hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  close
                </button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                <div className="bg-[#123B35]/5 dark:bg-emerald-950/20 rounded-2xl p-4 border border-[#168A78]/20">
                  <p className="text-xs sm:text-sm text-[#17212B] dark:text-slate-200 font-medium leading-relaxed">
                    👋 Hello Harshita! I am your personal AI tutor for Class 9. Ask me any concept, equation, or question!
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-xs font-extrabold text-[#68737A] dark:text-slate-400">How can I help you right now?</p>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/ai-tutor/chat');
                    }}
                    className="w-full text-left p-4 rounded-2xl bg-[#F7F3EA] dark:bg-slate-800 hover:bg-[#E9E3F8]/50 text-xs font-bold text-[#17212B] dark:text-white transition-colors flex items-center justify-between cursor-pointer border border-[#E6E0D5] dark:border-slate-700"
                  >
                    <span>💬 Start AI Chat Session</span>
                    <span className="material-symbols-outlined text-[#168A78] text-[18px]">arrow_forward</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/practice');
                    }}
                    className="w-full text-left p-4 rounded-2xl bg-[#F7F3EA] dark:bg-slate-800 hover:bg-[#E9E3F8]/50 text-xs font-bold text-[#17212B] dark:text-white transition-colors flex items-center justify-between cursor-pointer border border-[#E6E0D5] dark:border-slate-700"
                  >
                    <span>⚡ Practice Weak Concepts</span>
                    <span className="material-symbols-outlined text-[#168A78] text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>

              <div className="p-4 border-t border-[#E6E0D5] dark:border-slate-800 bg-[#F7F3EA] dark:bg-slate-800/60">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/ai-tutor/chat');
                  }}
                  className="w-full bg-[#123B35] text-white py-3.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md hover:bg-[#123B35]/90"
                >
                  <span>Open Full AI Chat</span>
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingAssistant;
