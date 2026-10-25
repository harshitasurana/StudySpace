import React from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardFooter = () => {
  const navigate = useNavigate();

  return (
    <footer className="w-full mt-4 pt-4 pb-16 text-[#68737A] dark:text-slate-400">
      <div className="flex justify-center sm:justify-start items-center gap-4 text-center sm:text-left px-4">
        <div className="w-8 h-8 rounded-xl bg-[#123B35] text-white flex items-center justify-center font-bold text-sm shrink-0">
          E
        </div>
        <div>
          <p className="font-handwriting text-2xl text-[#17212B] dark:text-slate-200">
            "Small steps make big progress."
          </p>
          <p className="text-xs text-[#68737A] dark:text-slate-400 font-medium">
            StudySpace — Learn Today. Build Tomorrow.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default DashboardFooter;
