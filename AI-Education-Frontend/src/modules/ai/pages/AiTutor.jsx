import React from 'react';
import ComingSoonPage from '../../../shared/ComingSoonPage';

// Admin Feature: "AI Tutor" (feature_id 283, route assumed /ai-tutor - this
// feature's own row was cut off in the admin Features screenshot, but its
// child "Tutor Chat" (284) is confirmed at /ai-tutor/chat, so the parent's
// router_link should follow the same prefix. Verify against the actual
// Feature row in admin > Features if this 404s.
const AiTutor = () => (
  <ComingSoonPage
    icon="smart_toy"
    title="AI Tutor"
    description="Get help from your AI tutor - open Tutor Chat from the sidebar to start a conversation."
  />
);

export default AiTutor;
