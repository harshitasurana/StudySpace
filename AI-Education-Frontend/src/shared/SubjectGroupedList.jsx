import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { groupItemsBySubject } from './groupItemsBySubject';

const SubjectGroupedList = ({ items, itemKey, renderItem, searchQuery = '', defaultOpen = false }) => {
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        (item.chapter_name && item.chapter_name.toLowerCase().includes(q)) ||
        (item.subject_name && item.subject_name.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const groups = useMemo(() => groupItemsBySubject(filteredItems), [filteredItems]);

  // Default all subjects to CLOSED (collapsed) as requested by user, unless defaultOpen=true or searching
  const [openKeys, setOpenKeys] = useState(() => {
    if (defaultOpen) {
      return new Set(groups.map((g) => g.key));
    }
    return new Set();
  });

  // Auto-expand all matching subjects when student types a search query
  useEffect(() => {
    if (searchQuery.trim()) {
      setOpenKeys(new Set(groups.map((g) => g.key)));
    }
  }, [searchQuery, groups]);

  const toggle = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setOpenKeys(new Set(groups.map((g) => g.key)));
  const collapseAll = () => setOpenKeys(new Set());

  const allOpen = groups.length > 0 && groups.every((g) => openKeys.has(g.key));

  if (filteredItems.length === 0 && searchQuery) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center space-y-3 border border-border-subtle/60">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">search_off</span>
        <p className="text-body-lg font-semibold text-on-surface">No matching items found</p>
        <p className="text-label-md text-on-surface-variant">Try searching for a different chapter or subject.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar with Expand All / Collapse All toggle */}
      {groups.length > 1 && (
        <div className="flex justify-end items-center px-1">
          <button
            onClick={allOpen ? collapseAll : expandAll}
            className="text-label-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {allOpen ? 'unfold_less' : 'unfold_more'}
            </span>
            {allOpen ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      )}

      {groups.map((group) => {
        const isOpen = openKeys.has(group.key);
        return (
          <motion.div
            key={group.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl overflow-hidden border border-border-subtle/70 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20"
          >
            <button
              onClick={() => toggle(group.key)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer hover:bg-surface-container-high/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[20px]">menu_book</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-body-md truncate group-hover:text-primary transition-colors">
                    {group.subjectName}
                  </h3>
                  <p className="text-label-sm text-on-surface-variant">
                    {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="px-2.5 py-1 rounded-full text-label-sm font-semibold bg-surface-container-high text-on-surface-variant">
                  {group.items.length}
                </span>
                <span
                  className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-primary' : 'rotate-0'
                  }`}
                >
                  expand_more
                </span>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="divide-y divide-border-subtle/60 border-t border-border-subtle/60 bg-surface-container-lowest/30"
                >
                  {group.items.map((item) => (
                    <React.Fragment key={itemKey(item)}>{renderItem(item)}</React.Fragment>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};

export default SubjectGroupedList;
