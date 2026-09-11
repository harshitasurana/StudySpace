import { AiConversation, AiMessage } from "./ai_tutor_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../academic/academic_schema.js";
import { EducationStudentNote } from "../notes/notes_schema.js";
import { QuizAttempt, QuizAnswer } from "../quiz/quiz_schema.js";
import { resolveStudentClassId, getChaptersService, resolveChapterByName } from "../curriculum/curriculum_service.js";
import { getChapterMasteryForStudent } from "../progress/progress_service.js";
import { getWeakestConceptForChapter } from "../quiz/quiz_service.js";
import { chatWithAiTutor, chatWithAiTutorImage } from "../../common/services/ai_service_client.js";
import { STORAGE_CATEGORIES, FILE_VISIBILITY, buildStorageKey, uploadStoredFile, resolveStoredFileUrl } from "../../common/services/fileStorage.service.js";
import { createEducationError } from "../education_errors.js";

// low/medium/high band off the same 0-100 mastery rubricScore the
// dashboard shows — just enough for the tutor prompt to adjust
// explanation depth, not exposed to the student directly (see
// STUDENT_MEMORY_RULES in RAGProductionApp/core/prompts.py: the model is
// told never to repeat memory scores back verbatim).
const masteryBand = (mastery) => (mastery < 40 ? "low" : mastery < 70 ? "medium" : "high");

// Builds the `memory` payload chatWithAiTutor forwards to FastAPI's
// already-built (but previously unused) personalization prompt slot —
// see progress_service.js's getChapterMasteryForStudent for why this is
// scoped to one chapter rather than reusing buildStudentChapterData's
// whole-syllabus computation on every chat message. Returns null (not an
// empty object) when there's no real signal yet, so callers can skip
// sending `memory` at all rather than sending a hollow shell.
const buildChapterMemory = async (studentProfileId, chapterId, chapterName) => {
  const [signal, weakestConcept] = await Promise.all([
    getChapterMasteryForStudent(studentProfileId, chapterId),
    getWeakestConceptForChapter(studentProfileId, { chapterId }),
  ]);
  if (!signal && !weakestConcept) return null;

  const memories = [];
  if (signal) {
    memories.push({
      memory_type: "chapter_mastery",
      text: `Mastery on "${chapterName}": ${masteryBand(signal.mastery)} (${signal.mastery}%) from ${
        signal.quiz_count + signal.mock_count
      } quiz/mock attempt(s).`,
    });
  }
  // Sharper than the chapter-wide mastery above — a specific sub-topic
  // within this chapter the student keeps missing, from real per-question
  // accuracy (see quiz_service.js's getWeakestConceptForChapter). Only
  // present once the student has answered enough concept-tagged questions
  // — never fabricated for a chapter they've barely touched.
  if (weakestConcept) {
    memories.push({
      memory_type: "weak_concept",
      text: `Within "${chapterName}", struggles most with: ${weakestConcept.concept} (${weakestConcept.accuracy}% correct across ${weakestConcept.total} question(s)).`,
    });
  }

  return { relevant_semantic_memories: memories };
};

/**
 * Every real AI Tutor conversation the student has — possibly several per
 * chapter now (see 20260816_ai_conversations_allow_multiple_per_chapter.sql),
 * newest-first. This is what "AI Sessions" is: a browsable history of
 * every past conversation across every chapter, not just the latest one.
 *
 * notes_count/quiz stats are chapter-level facts (notes and quiz attempts
 * aren't tied to one specific conversation thread), so when a chapter has
 * more than one conversation, every one of that chapter's cards shows the
 * same chapter-wide numbers — computed once per distinct chapter_id here,
 * not once per conversation, to avoid redundant duplicate queries.
 */
// Split out from listConversationsService so the Parent Portal can list a
// linked child's conversations by their already-resolved studentProfileId
// (after its own link/consent check), without duplicating this whole
// query+enrichment pipeline — see parent_service.js.
export const listConversationsForProfileService = async (studentProfileId) => {
  const conversations = await AiConversation.findAll({
    where: { student_profile_id: studentProfileId },
    include: [
      {
        model: EducationChapter,
        as: "chapter",
        attributes: ["chapter_id", "name", "subject_id"],
        include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  const chapterStatsCache = new Map();
  const getChapterStats = async (chapterId) => {
    if (chapterStatsCache.has(chapterId)) return chapterStatsCache.get(chapterId);

    const statsPromise = (async () => {
      const [notesCount, quizAttempts] = await Promise.all([
        EducationStudentNote.count({ where: { student_profile_id: studentProfileId, chapter_id: chapterId } }),
        QuizAttempt.findAll({
          where: { student_profile_id: studentProfileId, chapter_id: chapterId, status: "submitted" },
          attributes: ["attempt_id", "percentage"],
        }),
      ]);

      const attemptIds = quizAttempts.map((a) => a.attempt_id);
      const mistakesCount = attemptIds.length
        ? await QuizAnswer.count({ where: { attempt_id: attemptIds, is_correct: false } })
        : 0;
      const averageQuizScore = quizAttempts.length
        ? Math.round((quizAttempts.reduce((s, a) => s + Number(a.percentage), 0) / quizAttempts.length) * 100) / 100
        : null;

      return { notesCount, quizAttemptsCount: attemptIds.length, averageQuizScore, mistakesCount };
    })();

    chapterStatsCache.set(chapterId, statsPromise);
    return statsPromise;
  };

  const withCounts = await Promise.all(
    conversations.map(async (conv) => {
      const chapterId = conv.chapter_id;
      const [messageCount, stats] = await Promise.all([
        AiMessage.count({ where: { conversation_id: conv.conversation_id } }),
        getChapterStats(chapterId),
      ]);

      return {
        conversation_id: conv.conversation_id,
        chapter_id: chapterId,
        chapter_name: conv.chapter?.name || null,
        subject_id: conv.chapter?.subject?.subject_id || null,
        subject_name: conv.chapter?.subject?.name || null,
        message_count: messageCount,
        notes_count: stats.notesCount,
        quiz_attempts_count: stats.quizAttemptsCount,
        average_quiz_score: stats.averageQuizScore,
        mistakes_count: stats.mistakesCount,
        started_at: conv.created_at,
        last_active_at: conv.updated_at,
      };
    })
  );

  // Defensive only — every real conversation gets its first message in
  // the same request that creates it, so this should never actually
  // filter anything out in practice.
  return withCounts.filter((c) => c.message_count > 0);
};

/**
 * Every real AI Tutor conversation the student has — possibly several per
 * chapter now (see 20260816_ai_conversations_allow_multiple_per_chapter.sql),
 * newest-first. This is what "AI Sessions" is: a browsable history of
 * every past conversation across every chapter, not just the latest one.
 */
export const listConversationsService = async (userId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }
  return listConversationsForProfileService(studentScope.studentProfileId);
};

/**
 * Resolves which conversation a chat/history request means:
 *   1. An explicit conversationId, IF it's real and actually belongs to
 *      this student+chapter (never trusted blindly from the client).
 *   2. Otherwise the chapter's most recently started conversation.
 *   3. Otherwise (first ever message for this chapter) a brand new one.
 */
const resolveConversation = async (studentProfileId, chapterId, conversationId) => {
  if (conversationId) {
    const requested = await AiConversation.findOne({
      where: { conversation_id: conversationId, student_profile_id: studentProfileId, chapter_id: chapterId },
    });
    if (requested) return requested;
  }

  const mostRecent = await AiConversation.findOne({
    where: { student_profile_id: studentProfileId, chapter_id: chapterId },
    order: [["created_at", "DESC"]],
  });
  if (mostRecent) return mostRecent;

  return AiConversation.create({ student_profile_id: studentProfileId, chapter_id: chapterId });
};

const getHistory = async (conversationId) => {
  const messages = await AiMessage.findAll({
    where: { conversation_id: conversationId },
    order: [["created_at", "ASC"]],
  });
  return messages.map((m) => ({ role: m.role, content: m.content }));
};

// Shared by chatWithTutorService and startNewConversationService — both
// need the same "chapter is real and belongs to this student's class"
// check before touching any conversation.
const resolveOwnedChapter = async (studentScope, chapterId) => {
  const chapter = await EducationChapter.findOne({
    where: { chapter_id: chapterId, is_active: true },
    include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
  });
  if (!chapter) throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  if (chapter.class_id !== studentScope.classId) {
    throw createEducationError("Chapter does not belong to your class", 403, "CHAPTER_CLASS_MISMATCH");
  }
  return chapter;
};

// "I don't know which chapter" mode's equivalent of resolveOwnedChapter —
// same never-trust-the-client posture, just scoped one level up (subject,
// not chapter, since that's all we have yet). A subject with zero active
// chapters for this student's class either doesn't exist or doesn't apply
// here, so it's rejected the same way an unowned chapter_id is. Reuses
// getChaptersService's exact (subject_id, class_id) query shape rather
// than re-deriving subject/class scoping a second way.
const resolveOwnedSubject = async (studentScope, subjectId) => {
  const chapters = await getChaptersService({ subjectId, classId: studentScope.classId });
  if (!chapters.length) {
    throw createEducationError("Subject not found for your class", 404, "SUBJECT_NOT_FOUND");
  }
  return { subjectId, name: chapters[0].subject.name };
};

/**
 * subject_id/class_id/board/student_profile_id are all derived server-side
 * from the caller's own session — never trusted from the client. Only
 * chapter_id, question, and (optionally) which existing conversation to
 * continue come from the request body.
 *
 * chapterId may be null — "I don't know which chapter this is" mode, gated
 * on subjectId instead (see resolveOwnedSubject). ai_conversations.chapter_id
 * is NOT NULL at the schema level, so there's no "chapterless conversation"
 * row to create up front; instead the AI call happens first (scoped to the
 * subject, every chapter searched), and only once RAGProductionApp's
 * retrieved_chapters tells us which chapter the answer actually came from
 * do we resolve a real chapter_id and file the exchange into that chapter's
 * normal conversation thread — same conversation/message shape a student
 * would get by picking that chapter directly, just resolved after the fact
 * instead of before. If no chapter can be confidently resolved (off-topic
 * question, or a chapter name that didn't match anything), the reply is
 * still returned but isn't saved to any conversation — nothing in the
 * schema to save it under, and forcing it into an arbitrary chapter's
 * thread would be actively misleading history for the student to reread.
 */
export const chatWithTutorService = async (userId, { chapterId, subjectId, question, conversationId = null, responseMode = "text", addedByUserId = null }) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const profile = await EducationStudentProfile.findOne({
    where: { student_profile_id: studentScope.studentProfileId },
    include: [
      { model: EducationAcademicBoard, as: "board", attributes: ["name"] },
      { model: EducationAcademicClass, as: "class", attributes: ["name"] },
    ],
  });
  const board = profile?.board?.name || "CBSE";
  const standard = profile?.class?.name ? `Standard ${profile.class.name}` : "Standard 9";

  if (!chapterId) {
    const subject = await resolveOwnedSubject(studentScope, subjectId);

    let conversation = null;
    let history = [];
    if (conversationId) {
      conversation = await AiConversation.findOne({
        where: { conversation_id: conversationId, student_profile_id: studentScope.studentProfileId },
      });
      if (conversation) {
        history = await getHistory(conversation.conversation_id);
      }
    }

    const aiResponse = await chatWithAiTutor({
      question,
      subject: subject.name,
      // chapter omitted entirely — RAGProductionApp treats a missing
      // chapter as "search every chapter of this subject" (main.py's
      // ChatRequest.chapter is Optional[str] = None).
      conversation: history,
      board,
      standard,
      responseMode,
      memory: null,
    });

    const topChapterName = aiResponse.retrieved_chapters?.[0]?.chapter || null;
    const resolvedChapter = conversation
      ? await EducationChapter.findByPk(conversation.chapter_id, {
          include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
        })
      : await resolveChapterByName(topChapterName, subjectId, studentScope.classId);

    if (!conversation && !resolvedChapter) {
      return {
        conversation_id: null,
        answer: aiResponse.answer,
        source: aiResponse.source || [],
        figures: aiResponse.figures || [],
        citations: aiResponse.citations || [],
        identified_chapter: null,
      };
    }

    if (!conversation) {
      conversation = await resolveConversation(studentScope.studentProfileId, resolvedChapter.chapter_id, conversationId);
    }

    await AiMessage.create({ conversation_id: conversation.conversation_id, role: "user", content: question, added_by_user_id: addedByUserId });
    await AiMessage.create({
      conversation_id: conversation.conversation_id,
      role: "assistant",
      content: aiResponse.answer || "",
      sources: aiResponse.source || null,
      figures: aiResponse.figures || null,
      citations: aiResponse.citations || null,
    });
    await conversation.update({ updated_at: new Date() });

    const activeChapter = resolvedChapter || (await EducationChapter.findByPk(conversation.chapter_id, {
      include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
    }));

    return {
      conversation_id: conversation.conversation_id,
      answer: aiResponse.answer,
      source: aiResponse.source || [],
      figures: aiResponse.figures || [],
      citations: aiResponse.citations || [],
      identified_chapter: activeChapter ? { chapter_id: activeChapter.chapter_id, name: activeChapter.name, subject_name: subject.name } : null,
    };
  }

  const chapter = await resolveOwnedChapter(studentScope, chapterId);

  const conversation = await resolveConversation(studentScope.studentProfileId, chapterId, conversationId);
  const history = await getHistory(conversation.conversation_id);

  await AiMessage.create({ conversation_id: conversation.conversation_id, role: "user", content: question, added_by_user_id: addedByUserId });

  const memory = await buildChapterMemory(studentScope.studentProfileId, chapterId, chapter.name);

  const aiResponse = await chatWithAiTutor({
    question,
    subject: chapter.subject.name,
    chapter: chapter.name,
    conversation: history,
    board,
    standard,
    responseMode,
    memory,
  });

  await AiMessage.create({
    conversation_id: conversation.conversation_id,
    role: "assistant",
    content: aiResponse.answer || "",
    sources: aiResponse.source || null,
    figures: aiResponse.figures || null,
    citations: aiResponse.citations || null,
  });

  await conversation.update({ updated_at: new Date() });

  return {
    conversation_id: conversation.conversation_id,
    answer: aiResponse.answer,
    source: aiResponse.source || [],
    figures: aiResponse.figures || [],
    citations: aiResponse.citations || [],
  };
};

/**
 * Image-attach counterpart to chatWithTutorService — same
 * scope/chapter/conversation resolution, same memory build, same
 * assistant-message persistence; the two differences are (1) the image is
 * persisted to MinIO first (so it can be redisplayed on history reload)
 * and (2) chatWithAiTutorImage is called instead of chatWithAiTutor.
 * question may be empty — an image alone is a valid message.
 */
export const chatWithTutorImageService = async (
  userId,
  { chapterId, subjectId, question, conversationId = null, imageBuffer, imageMimeType, imageOriginalName, responseMode = "text", addedByUserId = null }
) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const profile = await EducationStudentProfile.findOne({
    where: { student_profile_id: studentScope.studentProfileId },
    include: [
      { model: EducationAcademicBoard, as: "board", attributes: ["name"] },
      { model: EducationAcademicClass, as: "class", attributes: ["name"] },
    ],
  });
  const board = profile?.board?.name || "CBSE";
  const standard = profile?.class?.name ? `Standard ${profile.class.name}` : "Standard 9";

  if (!chapterId) {
    const subject = await resolveOwnedSubject(studentScope, subjectId);

    let conversation = null;
    let history = [];
    if (conversationId) {
      conversation = await AiConversation.findOne({
        where: { conversation_id: conversationId, student_profile_id: studentScope.studentProfileId },
      });
      if (conversation) {
        history = await getHistory(conversation.conversation_id);
      }
    }

    const aiResponse = await chatWithAiTutorImage({
      imageBuffer,
      imageFilename: imageOriginalName || "image.jpg",
      question: question || "",
      subject: subject.name,
      mode: "Chat",
      conversation: history,
      board,
      standard,
      responseMode,
      memory: null,
    });

    const topChapterName = aiResponse.retrieved_chapters?.[0]?.chapter || null;
    const resolvedChapter = conversation
      ? await EducationChapter.findByPk(conversation.chapter_id, {
          include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
        })
      : await resolveChapterByName(topChapterName, subjectId, studentScope.classId);

    if (!conversation && !resolvedChapter) {
      return {
        conversation_id: null,
        answer: aiResponse.answer,
        source: aiResponse.source || [],
        figures: aiResponse.figures || [],
        citations: aiResponse.citations || [],
        identified_chapter: null,
      };
    }

    if (!conversation) {
      conversation = await resolveConversation(studentScope.studentProfileId, resolvedChapter.chapter_id, conversationId);
    }
    const imageKey = buildStorageKey({
      category: STORAGE_CATEGORIES.AI_TUTOR_CHAT_IMAGE,
      userId,
      conversationId: conversation.conversation_id,
      originalName: imageOriginalName,
    });
    await uploadStoredFile({
      file: { buffer: imageBuffer, mimetype: imageMimeType, originalname: imageOriginalName },
      key: imageKey,
      visibility: FILE_VISIBILITY.PRIVATE,
      metadata: { userId: String(userId) },
    });

    const imgDesc = aiResponse.image_description || "";
    const userContent = imgDesc
      ? (question ? `${question}\n\n[Attached Image Content]:\n${imgDesc}` : `[Attached Image Content]:\n${imgDesc}`)
      : (question || "");

    await AiMessage.create({
      conversation_id: conversation.conversation_id,
      role: "user",
      content: userContent,
      image_key: imageKey,
      added_by_user_id: addedByUserId,
    });

    await AiMessage.create({
      conversation_id: conversation.conversation_id,
      role: "assistant",
      content: aiResponse.answer || "",
      sources: aiResponse.source || null,
      figures: aiResponse.figures || null,
      citations: aiResponse.citations || null,
    });

    await conversation.update({ updated_at: new Date() });

    const activeChapter = resolvedChapter || (await EducationChapter.findByPk(conversation.chapter_id, {
      include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
    }));

    return {
      conversation_id: conversation.conversation_id,
      answer: aiResponse.answer,
      source: aiResponse.source || [],
      figures: aiResponse.figures || [],
      citations: aiResponse.citations || [],
      identified_chapter: activeChapter ? { chapter_id: activeChapter.chapter_id, name: activeChapter.name, subject_name: subject.name } : null,
      image_url: await resolveStoredFileUrl(imageKey, { visibility: FILE_VISIBILITY.PRIVATE }),
    };
  }

  const chapter = await resolveOwnedChapter(studentScope, chapterId);

  const conversation = await resolveConversation(studentScope.studentProfileId, chapterId, conversationId);
  const history = await getHistory(conversation.conversation_id);

  const imageKey = buildStorageKey({
    category: STORAGE_CATEGORIES.AI_TUTOR_CHAT_IMAGE,
    userId,
    conversationId: conversation.conversation_id,
    originalName: imageOriginalName,
  });
  await uploadStoredFile({
    file: { buffer: imageBuffer, mimetype: imageMimeType, originalname: imageOriginalName },
    key: imageKey,
    visibility: FILE_VISIBILITY.PRIVATE,
    metadata: { userId: String(userId) },
  });

  const memory = await buildChapterMemory(studentScope.studentProfileId, chapterId, chapter.name);

  const aiResponse = await chatWithAiTutorImage({
    imageBuffer,
    imageFilename: imageOriginalName || "image.jpg",
    question: question || "",
    subject: chapter.subject.name,
    chapter: chapter.name,
    conversation: history,
    board,
    standard,
    responseMode,
    memory,
  });

  const imgDesc = aiResponse.image_description || "";
  const userContent = imgDesc
    ? (question ? `${question}\n\n[Attached Image Content]:\n${imgDesc}` : `[Attached Image Content]:\n${imgDesc}`)
    : (question || "");

  await AiMessage.create({
    conversation_id: conversation.conversation_id,
    role: "user",
    content: userContent,
    image_key: imageKey,
    added_by_user_id: addedByUserId,
  });

  await AiMessage.create({
    conversation_id: conversation.conversation_id,
    role: "assistant",
    content: aiResponse.answer || "",
    sources: aiResponse.source || null,
    figures: aiResponse.figures || null,
    citations: aiResponse.citations || null,
  });

  await conversation.update({ updated_at: new Date() });

  return {
    conversation_id: conversation.conversation_id,
    answer: aiResponse.answer,
    source: aiResponse.source || [],
    figures: aiResponse.figures || [],
    citations: aiResponse.citations || [],
    image_url: await resolveStoredFileUrl(imageKey, { visibility: FILE_VISIBILITY.PRIVATE }),
  };
};

/**
 * "New chat" for a chapter — starts a brand new conversation row rather
 * than reusing/clearing an existing one, so every past conversation stays
 * intact and browsable from AI Sessions (see
 * 20260816_ai_conversations_allow_multiple_per_chapter.sql). The new
 * conversation starts truly empty; its first message is whatever the
 * student sends next via chatWithTutorService with this conversation_id.
 */
export const startNewConversationService = async (userId, chapterId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  await resolveOwnedChapter(studentScope, chapterId);

  const conversation = await AiConversation.create({
    student_profile_id: studentScope.studentProfileId,
    chapter_id: chapterId,
  });

  return { conversation_id: conversation.conversation_id };
};

/**
 * conversationId omitted/invalid -> the chapter's most recently started
 * conversation (matching Tutor Chat's default "reopen where I left off"
 * behavior); a real past conversation_id -> that exact one, so AI
 * Sessions can resume any specific past conversation, not just the latest.
 */
// Split out from getConversationHistoryService so the Parent Portal can
// fetch a linked child's transcript by their already-resolved
// studentProfileId — see listConversationsForProfileService above for the
// same pattern.
export const getConversationHistoryForProfileService = async (studentProfileId, chapterId, conversationId = null) => {
  let conversation = null;
  if (conversationId) {
    conversation = await AiConversation.findOne({
      where: { conversation_id: conversationId, student_profile_id: studentProfileId, chapter_id: chapterId },
    });
  }
  if (!conversation) {
    conversation = await AiConversation.findOne({
      where: { student_profile_id: studentProfileId, chapter_id: chapterId },
      order: [["created_at", "DESC"]],
    });
  }
  if (!conversation) return { conversation_id: null, messages: [] };

  const messages = await AiMessage.findAll({
    where: { conversation_id: conversation.conversation_id },
    order: [["created_at", "ASC"]],
  });

  const mappedMessages = await Promise.all(
    messages.map(async (m) => ({
      role: m.role,
      content: m.content,
      sources: m.sources,
      figures: m.figures,
      citations: m.citations,
      image_url: m.image_key ? await resolveStoredFileUrl(m.image_key, { visibility: FILE_VISIBILITY.PRIVATE }) : null,
      created_at: m.created_at,
    }))
  );

  return {
    conversation_id: conversation.conversation_id,
    messages: mappedMessages,
  };
};

/**
 * conversationId omitted/invalid -> the chapter's most recently started
 * conversation (matching Tutor Chat's default "reopen where I left off"
 * behavior); a real past conversation_id -> that exact one, so AI
 * Sessions can resume any specific past conversation, not just the latest.
 */
export const getConversationHistoryService = async (userId, chapterId, conversationId = null) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }
  return getConversationHistoryForProfileService(studentScope.studentProfileId, chapterId, conversationId);
};
