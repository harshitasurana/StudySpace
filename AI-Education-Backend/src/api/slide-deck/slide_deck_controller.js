import { generateSlideDeckService, getSlideDeckStatusService, recordSlideDeckCallbackService, listSlideDecksService } from "./slide_deck_service.js";

export const generateSlideDeckController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chapter_id, slide_deck_id } = req.body;

    const result = await generateSlideDeckService(userId, { chapterId: chapter_id, slideDeckId: slide_deck_id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to generate a slide deck" });
  }
};

export const slideDeckStatusController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.query.chapter_id);
    const slideDeckId = Number(req.query.slide_deck_id);

    const result = await getSlideDeckStatusService(userId, { chapterId, slideDeckId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch slide deck status" });
  }
};

// "My Learning Decks" — see MyLearningDecks.jsx.
export const listSlideDecksController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await listSlideDecksService(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch your learning decks" });
  }
};

// Called by RAGProductionApp's Celery worker (core/slide_deck_tasks.py),
// not the browser — see verifyServiceKey in slide_deck_routes.js.
export const slideDeckCallbackController = async (req, res) => {
  try {
    const row = await recordSlideDeckCallbackService(req.params.slideDeckId, req.body);
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record callback" });
  }
};
