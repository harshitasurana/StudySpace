import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { getMasteryTier, MASTERY_TIER_EMOJI } from '../../shared/masteryTier';
import { transitions } from '../../animations/transitions';
import { expandVariants } from '../../animations/variants';

const STATUS_LABELS = {
  mastered: { label: 'Mastered', color: 'text-success-mastery', bg: 'bg-success-mastery/10' },
  needs_practice: { label: 'Needs Practice', color: 'text-warning', bg: 'bg-warning/10' },
  struggling: { label: 'Struggling', color: 'text-error', bg: 'bg-error/10' },
  not_started: { label: 'Not Started', color: 'text-outline', bg: 'bg-surface-container' },
};

const TopicRow = ({ chapter, subjectId }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showStatusTooltip, setShowStatusTooltip] = useState(false);

  const tier = getMasteryTier(chapter.mastery);
  const statusInfo = STATUS_LABELS[tier] || STATUS_LABELS.not_started;

  const handleRowClick = () => {
    navigate(`/read/${chapter.chapter_id}`);
  };

  const handleExpandToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="border-b border-border-subtle/50 last:border-0">
      <button
        onClick={handleRowClick}
        className="w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-left transition-colors hover:bg-surface-container-low"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span aria-hidden="true" className="text-lg shrink-0">
            {MASTERY_TIER_EMOJI[tier]}
          </span>
          <span className="text-body-md text-on-surface font-medium truncate">{chapter.chapter_name}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-label-md font-bold ${statusInfo.color}`}>{chapter.mastery}%</span>
          <span
            onClick={handleExpandToggle}
            className="material-symbols-outlined text-outline text-[18px] hover:text-primary p-1 rounded-md"
            title="Toggle details"
          >
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={expandVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="px-4 py-3 bg-surface-container-lowest rounded-xl mb-2 ml-4 border-l-2 border-primary/30 space-y-3"
          >
            <div className="grid grid-cols-2 gap-2 text-label-sm">
              <div>
                <span className="text-on-surface-variant block">Score:</span>
                <span className="font-bold text-on-surface">{chapter.mastery}%</span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Status:</span>
                <span className={`font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
              <span className="text-label-sm text-on-surface-variant">Recommended Action</span>
              <button
                onClick={() => navigate(`/read/${chapter.chapter_id}`)}
                className="bg-primary text-on-primary text-label-sm px-4 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>Start Practice</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopicRow;
