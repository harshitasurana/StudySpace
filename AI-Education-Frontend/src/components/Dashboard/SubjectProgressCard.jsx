import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sigma, FlaskConical, BookOpen, Globe2, Shapes } from 'lucide-react';
import TopicRow from './TopicRow';
import { transitions, easing } from '../../animations/transitions';

// Purely presentational: maps a real subject_name to an icon/colour so
// subject cards are visually distinguishable, same idea as the mockup.
// Falls back to a generic icon for any subject name not in this list -
// never blocks rendering on an unmatched name.
const SUBJECT_STYLE = [
  { match: /math/i, icon: Sigma, bg: 'bg-indigo-500/10', fg: 'text-indigo-600' },
  { match: /science/i, icon: FlaskConical, bg: 'bg-emerald-500/10', fg: 'text-emerald-600' },
  { match: /english|hindi|language/i, icon: BookOpen, bg: 'bg-rose-500/10', fg: 'text-rose-600' },
  { match: /social|geography|history|civics/i, icon: Globe2, bg: 'bg-amber-500/10', fg: 'text-amber-600' },
];
const DEFAULT_SUBJECT_STYLE = { icon: Shapes, bg: 'bg-primary/10', fg: 'text-primary' };
const getSubjectStyle = (name) => SUBJECT_STYLE.find((s) => s.match.test(name || '')) || DEFAULT_SUBJECT_STYLE;

const SubjectProgressCard = ({ subject, activeFilter, sortByWeakest }) => {
  const style = getSubjectStyle(subject.subject_name);
  const SubjectIcon = style.icon;
  const [showAllChapters, setShowAllChapters] = useState(false);

  // Filter chapters based on active status filter
  let chapters = subject.chapters || [];

  if (activeFilter && activeFilter !== 'all') {
    chapters = chapters.filter((c) => {
      if (activeFilter === 'mastered') return c.mastery >= 80;
      if (activeFilter === 'needs_practice') return c.mastery >= 50 && c.mastery < 80;
      if (activeFilter === 'struggling') return c.mastery > 0 && c.mastery < 50;
      if (activeFilter === 'not_started') return c.mastery === 0;
      return true;
    });
  }

  // Sort by weakest topic if requested
  if (sortByWeakest) {
    chapters = [...chapters].sort((a, b) => a.mastery - b.mastery);
  }

  const visibleChapters = showAllChapters ? chapters : chapters.slice(0, 4);

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-primary/30">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-9 h-9 rounded-lg ${style.bg} ${style.fg} flex items-center justify-center shrink-0`}>
              <SubjectIcon size={18} strokeWidth={2.25} />
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{subject.subject_name}</h3>
          </div>
          <span className="text-label-md font-bold text-primary shrink-0">{subject.mastery}%</span>
        </div>

        {/* Viewport animated progress bar */}
        <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden mb-5">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${subject.mastery}%` }}
            transition={{ duration: 0.8, ease: easing }}
          />
        </div>

        {/* Topic rows */}
        {chapters.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant italic py-2">No topics match current filter.</p>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {visibleChapters.map((chapter) => (
                <TopicRow key={chapter.chapter_id} chapter={chapter} subjectId={subject.subject_id} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Show More / Show Less Toggle */}
      {chapters.length > 4 && (
        <div className="mt-4 pt-3 border-t border-border-subtle flex justify-center">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowAllChapters(!showAllChapters)}
            className="text-label-sm font-bold text-primary flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>{showAllChapters ? 'Show Less' : `Show All ${chapters.length} Topics`}</span>
            <span className="material-symbols-outlined text-[16px]">
              {showAllChapters ? 'expand_less' : 'expand_more'}
            </span>
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default SubjectProgressCard;
