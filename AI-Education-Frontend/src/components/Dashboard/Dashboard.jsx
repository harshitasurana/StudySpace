import React from 'react';
import { motion } from 'motion/react';
import GuidedWalkthrough from '../../shared/GuidedWalkthrough';
import DashboardHeader from './DashboardHeader';
import LearningJourney from './LearningJourney';
import RecommendationCard from './RecommendationCard';
import ContinueLearningCard from './ContinueLearningCard';
import YourSubjectsCard from './YourSubjectsCard';
import QuickActions from './QuickActions';
import AIInsight from './AIInsight';
import LearningMomentum from './LearningMomentum';
import RecentActivity from './RecentActivity';
import DashboardFooter from './DashboardFooter';
import { containerVariants } from '../../animations/variants';

const Dashboard = ({
  runWalkthrough,
  handleWalkthroughFinish,
  t,
  greetingName,
  renderIdentityLine,
  dashboard,
  loadingRecommendation,
  recommendedNext,
  streakDays,
  loadingGameStats,
  weeklyMission,
  weeklyPercent,
  codeCopied,
  handleCopyCode,
  missionLoaded,
  missionState,
  dailyMission,
  weakestChapter,
  continueChapter,
  handleContinue,
  loadingProgress,
  progressError,
  formatLastStudied,
  showComingSoon,
  comingSoonLabel,
  strongestChapter,
  handleRecommendedAction,
  loadingSubjectProgress,
  subjectProgress,
  recentActivity,
  ATTEMPT_TYPE_LABEL,
  formatRelativeTime,
  recentActivityTarget,
}) => {
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  return (
    <motion.main
      variants={containerVariants}
      initial={isTest ? false : "hidden"}
      animate="visible"
      className="flex-grow py-4 px-4 sm:px-6 md:px-8 bg-[#F7F3EA] dark:bg-[#0b1324] relative min-h-0"
    >
      {runWalkthrough && <GuidedWalkthrough onFinish={handleWalkthroughFinish} />}

      <div className="w-full space-y-3.5">
        {/* Row 1: Header (Greeting & Stats + Hero Banner + Meet EduAI Card) */}
        <DashboardHeader
          welcomeText={t?.welcome || 'Welcome'}
          greetingName={greetingName}
          identityLine={renderIdentityLine(dashboard)}
          loadingRecommendation={loadingRecommendation}
          streakDays={streakDays}
          loadingGameStats={loadingGameStats}
          weeklyMission={weeklyMission}
          weeklyPercent={weeklyPercent}
          studentCode={dashboard?.student_code}
          codeCopied={codeCopied}
          onCopyCode={handleCopyCode}
          dashboard={dashboard}
        />

        {/* Unified 2-Column Dashboard Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (7 cols): Learning Journey → Continue Learning → Chapter-Wise Progress → Momentum */}
          <div className="lg:col-span-7 space-y-4">
            <LearningJourney />
            <ContinueLearningCard
              loadingProgress={loadingProgress}
              progressError={progressError}
              continueChapter={continueChapter}
              formatLastStudied={formatLastStudied}
              onContinue={handleContinue}
            />
            <YourSubjectsCard subjectProgress={subjectProgress} />
            <LearningMomentum dashboard={dashboard} weeklyPercent={weeklyPercent} />
          </div>

          {/* Right Column (5 cols): Today's Plan → AI Recommends → Quick Actions → Recent Activity */}
          <div className="lg:col-span-5 space-y-4">
            <RecommendationCard
              missionState={missionState}
              dailyMission={dailyMission}
              weakestChapter={weakestChapter}
              continueChapter={continueChapter}
              weeklyPercent={weeklyPercent}
              dashboard={dashboard}
              onContinue={handleContinue}
            />
            <AIInsight
              loadingRecommendation={loadingRecommendation}
              recommendedNext={recommendedNext}
              continueChapter={continueChapter}
              strongestChapter={strongestChapter}
              weakestChapter={weakestChapter}
              t={t}
              onRecommendedAction={handleRecommendedAction}
            />
            <QuickActions showComingSoon={showComingSoon} comingSoonLabel={comingSoonLabel} />
            <RecentActivity
              recentActivity={recentActivity}
              ATTEMPT_TYPE_LABEL={ATTEMPT_TYPE_LABEL}
              formatRelativeTime={formatRelativeTime}
              recentActivityTarget={recentActivityTarget}
            />
          </div>
        </div>

        {/* Intentional Footer */}
        <DashboardFooter />
      </div>
    </motion.main>
  );
};

export default Dashboard;
