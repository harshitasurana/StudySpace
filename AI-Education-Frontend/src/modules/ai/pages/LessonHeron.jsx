import React from 'react';
import TutorChat from './TutorChat';

// Previously a hardcoded "Heron's Formula" lesson page (fixed content
// regardless of which chapter the student was actually continuing) whose
// floating AI chat called fetch() directly against VITE_API_URL +
// "/api/tutor/chat" — the AI service's route, not the Node backend's
// (/api/ai-tutor/chat) — so it 404'd on every message and silently fell
// back to one hardcoded reply. "Continue" for an in-progress chapter now
// opens the real, chapter-grounded AI Tutor instead (Phase 7 hardening).
const LessonHeron = () => <TutorChat />;

export default LessonHeron;
