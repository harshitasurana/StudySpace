import sequelize from "../../config/database.js";
import { SamplePaperAttempt, SamplePaperResponse, SamplePaperGradingLog } from "./sample_paper_attempt_schema.js";
import { createEducationError } from "../education_errors.js";

/**
 * FastAPI's callback once core/sample_paper_grading.py has read the
 * student's answer PDF, matched each answer to its real question by
 * number, and graded it against the real rubric/model_answer. results is
 * one entry per question on the paper (matched or not):
 * [{ question_id, transcribed_answer, max_marks, marks_awarded,
 *    rubric_breakdown, feedback, internal_notes, confidence,
 *    needs_self_review }]
 *
 * Wrapped in a transaction (same discipline as
 * sample_paper_admin_service.js's recordExtractionCallbackService fix —
 * this environment has hit real mid-callback server restarts before) and
 * idempotent by checking the attempt's own status: a retried callback for
 * an attempt already settled (graded/failed) is a no-op, not a second
 * write. The grading log row is the one intentional exception — every
 * callback attempt gets its own log row, since a retry happening at all is
 * itself useful debugging signal.
 */
export const recordGradingCallbackService = async (attemptId, { status, results, error_message }) => {
  return sequelize.transaction(async (t) => {
    const attempt = await SamplePaperAttempt.findOne({
      where: { attempt_id: attemptId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!attempt) throw createEducationError("Attempt not found", 404, "ATTEMPT_NOT_FOUND");

    if (attempt.status === "graded" || attempt.status === "failed") {
      await SamplePaperGradingLog.create(
        { attempt_id: attemptId, status: status === "failed" ? "failed" : "completed", error_message: error_message || null, raw_output: null },
        { transaction: t }
      );
      return attempt; // already settled — retried callback, no-op beyond logging
    }

    if (status === "failed") {
      await attempt.update({ status: "failed", grading_error: error_message || "Grading failed" }, { transaction: t });
      await SamplePaperGradingLog.create(
        { attempt_id: attemptId, status: "failed", error_message: error_message || "Grading failed" },
        { transaction: t }
      );
      return attempt;
    }

    const rows = Array.isArray(results) ? results : [];
    let totalAwarded = 0;
    for (const r of rows) {
      if (!r.question_id || !r.max_marks) continue;
      const marksAwarded = r.marks_awarded ?? 0;
      totalAwarded += Number(marksAwarded) || 0;

      const [response] = await SamplePaperResponse.findOrCreate({
        where: { attempt_id: attempt.attempt_id, question_id: r.question_id },
        defaults: { max_marks: r.max_marks },
        transaction: t,
      });
      await response.update(
        {
          transcribed_answer: r.transcribed_answer || null,
          max_marks: r.max_marks,
          marks_awarded: marksAwarded,
          rubric_breakdown: r.rubric_breakdown && r.rubric_breakdown.length > 0 ? r.rubric_breakdown : null,
          feedback: r.feedback || null,
          grading_internal_notes: r.internal_notes || null,
          grading_confidence: r.confidence || null,
          needs_self_review: !!r.needs_self_review,
          graded_at: new Date(),
        },
        { transaction: t }
      );
    }

    const percentage = attempt.total_marks > 0 ? (totalAwarded / attempt.total_marks) * 100 : 0;
    await attempt.update(
      {
        status: "graded",
        score: totalAwarded,
        percentage: Math.round(percentage * 100) / 100,
        graded_at: new Date(),
      },
      { transaction: t }
    );

    await SamplePaperGradingLog.create(
      { attempt_id: attemptId, status: "completed", questions_graded: rows.length },
      { transaction: t }
    );

    return attempt;
  });
};
