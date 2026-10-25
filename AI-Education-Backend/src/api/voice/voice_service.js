import { transcribeAudio, synthesizeSpeech } from "../../common/services/ai_service_client.js";
import { chatWithTutorService } from "../ai-tutor/ai_tutor_service.js";
import { createEducationError } from "../education_errors.js";

/**
 * Orchestrates one push-to-talk voice turn — transcribe, then reuse the
 * EXACT SAME chatWithTutorService the text chat path uses (RAG,
 * intent routing, conversation persistence, all of it), then speak the
 * answer. This file has zero tutor/RAG logic of its own — that's the
 * whole point of the "one TutorEngine, multiple interaction modes"
 * architecture. A voice turn produces exactly the same AiMessage pair a
 * typed turn would; nothing new is persisted here.
 */
export const handleVoiceTurnService = async (userId, { chapterId, conversationId, audioBuffer, filename, mimetype }) => {
  const transcription = await transcribeAudio({ audioBuffer, filename, mimetype });
  const questionText = (transcription.text || "").trim();

  if (!questionText) {
    throw createEducationError("Didn't catch that — try again", 422, "EMPTY_TRANSCRIPTION");
  }

  const result = await chatWithTutorService(userId, {
    chapterId,
    question: questionText,
    conversationId,
    responseMode: "voice",
  });

  const speech = await synthesizeSpeech({ text: result.answer });

  return {
    conversation_id: result.conversation_id,
    question_text: questionText,
    question_language: transcription.language,
    answer_text: result.answer,
    source: result.source,
    figures: result.figures,
    citations: result.citations,
    audio_base64: speech.audio_base64,
    audio_format: speech.format,
  };
};
