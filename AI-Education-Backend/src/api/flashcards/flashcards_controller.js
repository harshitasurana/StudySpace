import {
  generateFlashcardsService,
  getFlashcardSetStatusService,
  recordFlashcardGenerationCallbackService,
  listFlashcardSetsService,
} from "./flashcards_service.js";

export const generateFlashcardsController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chapter_id, num_cards, source_text } = req.body;

    const result = await generateFlashcardsService(userId, {
      chapterId: chapter_id,
      numCards: num_cards,
      sourceText: source_text,
      addedByUserId: req.user.acting_as_parent_user_id || null,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to generate flashcards" });
  }
};

export const getFlashcardSetStatusController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const setId = Number(req.params.setId);
    const result = await getFlashcardSetStatusService(userId, setId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch flashcard set status" });
  }
};

// Called by RAGProductionApp's Celery worker (core/flashcard_tasks.py),
// not the browser — see verifyServiceKey in flashcards_routes.js for the
// auth check.
export const flashcardGenerationCallbackController = async (req, res) => {
  try {
    const set = await recordFlashcardGenerationCallbackService(req.params.setId, req.body);
    return res.status(200).json({ success: true, data: set });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record callback" });
  }
};

export const listFlashcardSetsController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await listFlashcardSetsService(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load flashcard sets" });
  }
};
