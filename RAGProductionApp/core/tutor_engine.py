import json
import logging
import os
import random
import re
import time
from dotenv import load_dotenv
from ollama import Client
from observability.langfuse_client import langfuse
import core.llm_provider as llm_provider

logger = logging.getLogger(__name__)
from core.prompts import (
    SYSTEM_PROMPT,
    SYSTEM_PROMPT_HINDI,
    SYSTEM_PROMPT_GUJARATI,
    QA_PROMPT,
    EXPLAIN_PROMPT,
    HINT_PROMPT,
    MCQ_PROMPT,
    QUESTION_PAPER_PROMPT,
    ANSWER_SHEET_PROMPT,
    SUMMARY_PROMPT,
    REVISION_PROMPT,
    QUIZ_PROMPT,
    FLASHCARD_PROMPT,
    STUDY_PLAN_INTRO_PROMPT,
    MIND_MAP_PROMPT,
    MIND_MAP_LENS_INSTRUCTIONS,
    MIND_MAP_RELATIONSHIPS_PROMPT,
    MIND_MAP_GRANDCHILDREN_PROMPT,
    TEST_REVIEW_PROMPT,
    SAMPLE_PAPER_ANSWER_DRAFT_PROMPT,
    SLIDE_DECK_PROMPT,
    INFOGRAPHIC_PROMPT,
    VOICE_RESPONSE_INSTRUCTIONS,
)

from core.intent_router import Intent
from core.assessment import QuizQuestion
from core.cache_utils import TTLCache


# =========================================
# LOAD ENVIRONMENT VARIABLES
# =========================================

load_dotenv()


# =========================================
# OLLAMA CONFIG
# =========================================

OLLAMA_HOST = os.getenv(
    "OLLAMA_HOST",
    "http://127.0.0.1:11434",
)

# Renamed from OLLAMA_CHAT_MODEL — kept as its own name (rather than a
# generic OLLAMA_* one) so it can be repointed independently of other
# pipelines without any code change.
OLLAMA_CHAT_MODEL = os.getenv(
    "TUTOR_CHAT_MODEL",
    "llama3",
)

# Used only when the chat request's subject is itself "Hindi"/"Gujarati"
# (a language subject, taught in that language - not a generic
# translate-any-subject toggle). Chosen from this session's local-model
# evaluation; always routed to local Ollama, bypassing the cloud
# provider - see the force_local param on _chat().
OLLAMA_CHAT_MODEL_HI = os.getenv(
    "TUTOR_CHAT_MODEL_HI",
    "gemma3:4b",
)
OLLAMA_CHAT_MODEL_GU = os.getenv(
    "TUTOR_CHAT_MODEL_GU",
    "gemma3:4b",
)

OLLAMA_NUM_CTX = int(
    os.getenv(
        "OLLAMA_NUM_CTX",
        "4096",
    )
)

OLLAMA_QUIZ_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_QUIZ_NUM_PREDICT",
        "2500",
    )
)

# Chat's answer budget used to share the generic 500-token default every
# other generation type already had its own dedicated, larger constant
# for (quiz/flashcards/mindmap/study-plan) — chat never did. 500 tokens
# doesn't fit a real step-by-step worked-solution answer (e.g. an NCERT
# Solutions walkthrough with its own citation) without truncating
# mid-thought. OLLAMA_CHAT_NUM_CTX is a separate context-window constant
# (not a reuse
# of the shared OLLAMA_NUM_CTX, which many other generation calls also
# use and shouldn't be affected by this) sized to actually hold a bigger
# answer alongside a full prompt (system + question + conversation +
# memory + up to RAG_CONTEXT_MAX_CHARS of evidence) — same reasoning
# core/sample_paper_extraction.py's OllamaPageVisionReader already
# documents for its own num_ctx=8192 default.
OLLAMA_CHAT_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_CHAT_NUM_PREDICT",
        "1400",
    )
)
OLLAMA_CHAT_NUM_CTX = int(
    os.getenv(
        "OLLAMA_CHAT_NUM_CTX",
        "8192",
    )
)

OLLAMA_TEMPERATURE = float(
    os.getenv(
        "OLLAMA_TEMPERATURE",
        "0.3",
    )
)


# =========================================
# RAG CONFIG
# =========================================

RAG_CONTEXT_MAX_CHARS = int(
    os.getenv(
        "RAG_CONTEXT_MAX_CHARS",
        "6000",
    )
)


# =========================================
# QUIZ CONFIG
# =========================================

DEFAULT_QUIZ_QUESTIONS = int(
    os.getenv(
        "DEFAULT_QUIZ_QUESTIONS",
        "10",
    )
)
# generate_quiz's prompt tells Ollama "generate exactly N questions", but
# that's only ever a prompt instruction, not enforced anywhere — a local
# model under instruction-following pressure sometimes returns a
# well-formed but SHORT JSON array (e.g. 3 questions when 5 were asked
# for), which parsed and shipped as a normal "completed" quiz with a
# genuinely lower total_questions. That's the actual cause behind a real
# student report of "pre-assessment questions are incomplete" — nothing
# was malformed or truncated mid-generation, the model just didn't
# generate enough. Retried (fresh Ollama call, already-random seed) up to
# this many extra times before giving up and returning whatever came back.
MAX_QUIZ_GENERATION_RETRIES = int(
    os.getenv(
        "MAX_QUIZ_GENERATION_RETRIES",
        "2",
    )
)
OLLAMA_QUIZ_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_QUIZ_NUM_PREDICT",
        "2500",
    )
)

OLLAMA_QUIZ_TEMPERATURE = float(
    os.getenv(
        "OLLAMA_QUIZ_TEMPERATURE",
        # 0.1 made quiz generation nearly deterministic: the same chapter,
        # same context, and same near-greedy sampling produced the same
        # (or near-same) quiz on every "Start Quiz" click. Raised so
        # repeated generations for a chapter actually differ, while the
        # Ollama structured `format` schema still keeps every question
        # well-formed regardless of temperature.
        "0.7",
    )
)


# =========================================
# FLASHCARD CONFIG
# =========================================

DEFAULT_FLASHCARD_COUNT = int(
    os.getenv(
        "DEFAULT_FLASHCARD_COUNT",
        "8",
    )
)
OLLAMA_FLASHCARD_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_FLASHCARD_NUM_PREDICT",
        "2000",
    )
)
OLLAMA_FLASHCARD_TEMPERATURE = float(
    os.getenv(
        "OLLAMA_FLASHCARD_TEMPERATURE",
        "0.7",
    )
)



# =========================================
# STUDY PLAN INTRO CONFIG
# =========================================

OLLAMA_STUDY_PLAN_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_STUDY_PLAN_NUM_PREDICT",
        # Short output by design (2-3 sentences) — kept low so a slow
        # generation never becomes the bottleneck on a page that's mostly
        # real, already-computed data.
        "300",
    )
)
OLLAMA_STUDY_PLAN_TEMPERATURE = float(
    os.getenv(
        "OLLAMA_STUDY_PLAN_TEMPERATURE",
        "0.6",
    )
)


# =========================================
# MIND MAP CONFIG
# =========================================

OLLAMA_MINDMAP_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_MINDMAP_NUM_PREDICT",
        # Bumped from 3000: every branch AND every child now also carries
        # a real 1-2 sentence "description" (previously just label/type/
        # evidence_block — a few words each). Worst case is 10 branches x
        # 6 children each, every one with its own description — a
        # meaningful multiple of the old all-labels output size, not just
        # a small bump.
        "6000",
    )
)
OLLAMA_MINDMAP_TEMPERATURE = float(
    os.getenv(
        "OLLAMA_MINDMAP_TEMPERATURE",
        "0.4",
    )
)
# Separate, smaller budget for the relationships call — its input is
# lean (branch index/type/label only, not sub-points) and its output is
# capped at 15 short relationship objects, nowhere near branch
# generation's worst case.
OLLAMA_MINDMAP_RELATIONSHIPS_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_MINDMAP_RELATIONSHIPS_NUM_PREDICT",
        "1500",
    )
)
# Third call, single-node scope (one node's own label + a small targeted
# evidence block, not the whole chapter) — smaller than even the
# relationships budget. Bumped from 800 for the same reason as
# OLLAMA_MINDMAP_NUM_PREDICT — grandchildren now carry descriptions too,
# just over a smaller worst case (2-4 grandchildren, not 6-10 x 6).
OLLAMA_MINDMAP_CHILDREN_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_MINDMAP_CHILDREN_NUM_PREDICT",
        "1500",
    )
)


# =========================================
# AI LEARNING DECK CONFIG (Phase 1, widened in the "more detail" pass)
# =========================================

# Raised from 5000 alongside the prompt's slide count (8-12 -> 12-18)
# and per-slide richness (longer explanations, more key_points/steps) —
# sized generously rather than under-provisioning and discovering the
# gap later, the same mistake OLLAMA_MINDMAP_NUM_PREDICT's own history
# already shows (had to be raised after real output exceeded an initial
# too-small budget).
OLLAMA_SLIDE_DECK_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_SLIDE_DECK_NUM_PREDICT",
        "6500",
    )
)
# A dedicated, larger context window (was silently sharing the generic
# OLLAMA_NUM_CTX=4096, which can't actually hold a wider retrieved
# context PLUS a 6500-token output budget at the same time — the model
# would just be truncated regardless of num_predict). Same reasoning
# OLLAMA_CHAT_NUM_CTX=8192 already documents for chat's own bigger
# answers; slide-deck generation gets the same ceiling rather than an
# unproven larger one, since it isn't confirmed every locally-configured
# model here supports more.
OLLAMA_SLIDE_DECK_NUM_CTX = int(
    os.getenv(
        "OLLAMA_SLIDE_DECK_NUM_CTX",
        "8192",
    )
)
OLLAMA_SLIDE_DECK_TEMPERATURE = float(
    os.getenv(
        "OLLAMA_SLIDE_DECK_TEMPERATURE",
        "0.4",
    )
)

# Same reasoning as the slide-deck constants above — a whole-chapter
# infographic (4-8 concepts plus formulas/definitions/mistakes/tips/
# recap) is comparable output volume to a 12-18 slide deck, so it starts
# from the same proven ctx/predict/temperature values rather than an
# unvalidated guess.
OLLAMA_INFOGRAPHIC_NUM_PREDICT = int(
    os.getenv(
        "OLLAMA_INFOGRAPHIC_NUM_PREDICT",
        "6500",
    )
)
OLLAMA_INFOGRAPHIC_NUM_CTX = int(
    os.getenv(
        "OLLAMA_INFOGRAPHIC_NUM_CTX",
        "8192",
    )
)
OLLAMA_INFOGRAPHIC_TEMPERATURE = float(
    os.getenv(
        "OLLAMA_INFOGRAPHIC_TEMPERATURE",
        "0.4",
    )
)


# =========================================
# SPRINT E — PERFORMANCE / RELIABILITY CONFIG
# =========================================

# Verbose per-request debug prints are useful when developing but a
# real cost at scale. Default off; flip TUTOR_DEBUG_LOGS=true locally.
TUTOR_DEBUG_LOGS = (
    os.getenv("TUTOR_DEBUG_LOGS", "false").lower() == "true"
)


def _debug(*args) -> None:
    if TUTOR_DEBUG_LOGS:
        print(*args)


# Figure context text is rebuilt on every turn even though the same
# retrieved figures are frequently reused across a short exchange
# (e.g. a follow-up on the same figure). Cache the built text per
# figure set, and cap its size so a large multi-figure retrieval
# can't blow up the prompt.
FIGURE_CONTEXT_CACHE_TTL = float(
    os.getenv("FIGURE_CONTEXT_CACHE_TTL", "300")
)
FIGURE_CONTEXT_MAX_CHARS = int(
    os.getenv("FIGURE_CONTEXT_MAX_CHARS", "2500")
)

_figure_context_cache = TTLCache(
    maxsize=256,
    ttl=FIGURE_CONTEXT_CACHE_TTL,
)

# Friendly, non-alarming fallback shown to the student when the LLM
# generation itself fails after everything upstream (retrieval,
# prompt building) succeeded — e.g. Ollama times out or errors. The
# tutor should degrade gracefully rather than surface a stack trace.
GENERATION_FALLBACK_MESSAGE = (
    "I'm having trouble putting together an answer right now. "
    "Please try asking again in a moment."
)

# Several prompts explicitly say "no preamble", but Ollama still
# sometimes prepends a line like "Here is the result:" before the real
# content — stripped defensively rather than trusting prompt compliance
# alone, since that line would otherwise render as the first line of
# whatever it's generating.
_MARKDOWN_PREAMBLE_RE = re.compile(
    r"^(here'?s?|below is|sure|certainly|okay|here is)\b.*:\s*\n+",
    re.IGNORECASE,
)


def _strip_markdown_preamble(text: str) -> str:
    return _MARKDOWN_PREAMBLE_RE.sub("", text, count=1).strip()


class TutorEngine:

    def __init__(
        self,
        model: str | None = None,
        host: str | None = None,
    ):

        self.model = (
            model or OLLAMA_CHAT_MODEL
        )

        self.host = (
            host or OLLAMA_HOST
        )

        self.client = Client(
            host=self.host
        )

    def _chat(self, *, model, messages, format=None, options=None, force_local=False):
        """Routes through the Admin UI's active cloud/local provider when
        it has an active API key configured, falling back to the local
        Ollama client otherwise — same call signature and return shape as
        self.client.chat(), so every call site below only needed this
        one-line swap.

        force_local=True skips the cloud-provider attempt entirely and
        calls Ollama directly - used for Hindi/Gujarati subject chat,
        since the cloud provider's language quality is untested and the
        Ollama model in `model` was chosen specifically for this."""
        options = options or {}
        if force_local:
            return self.client.chat(model=model, messages=messages, format=format, options=options)
        try:
            content = llm_provider.generate(
                messages=messages,
                schema=format,
                temperature=options.get("temperature", OLLAMA_TEMPERATURE),
                num_predict=options.get("num_predict"),
                num_ctx=options.get("num_ctx"),
                seed=options.get("seed"),
            )
            logger.info("tutor_engine chat completion served by %s", llm_provider.current_provider_name())
            return {"message": {"content": content}}
        except llm_provider.LLMUnavailable as exc:
            logger.info("tutor_engine chat completion falling back to Ollama (%s)", exc)
            try:
                return self.client.chat(model=model, messages=messages, format=format, options=options)
            except Exception as ollama_exc:
                # Neither the active cloud provider nor the local Ollama
                # fallback could answer — re-raise as the same
                # LLMUnavailable type every caller already knows how to
                # catch (see main.py's Help Center/Parent Insights chat
                # handlers), instead of letting Ollama's raw connection
                # error propagate as an unhandled 500. Previously this
                # path had no try/except at all, so an unreachable Ollama
                # host crashed every AI Tutor chat request outright.
                logger.exception("tutor_engine chat completion failed — both cloud provider and Ollama fallback unavailable")
                raise llm_provider.LLMUnavailable(f"Ollama fallback also failed: {ollama_exc}") from ollama_exc

    # =====================================
    # BUILD FIGURE CONTEXT
    # =====================================

    def _build_figure_context(
        self,
        figures: list[dict] | None,
    ) -> str:
        """
        Convert retrieved textbook figure groups into
        prompt-ready text.

        Only educational metadata is included.
        Image paths are intentionally excluded because
        they are used by the frontend, not the LLM.
        """

        if not figures:
            return "No textbook figures were retrieved."

        cache_key = tuple(
            (
                figure.get("reference_label", ""),
                figure.get("page_number"),
                figure.get("subject", ""),
                figure.get("chapter", ""),
            )
            for figure in figures
        )

        cached_text, hit = _figure_context_cache.get(cache_key)

        if hit:
            _debug("[TUTOR] Figure context cache hit")
            return cached_text

        sections = []

        for index, figure in enumerate(
            figures,
            start=1,
        ):

            lines = [

                f"Reference: {figure.get('reference_label', 'Unknown')}",

                f"Page: {figure.get('page_number', 'Unknown')}",

                f"Subject: {figure.get('subject', '')}",

                f"Chapter: {figure.get('chapter', '')}",

                f"Visual type: {figure.get('visual_type', '')}",
            ]

            visual_subtype = figure.get(
                "visual_subtype",
                "",
            )

            if visual_subtype:
                lines.append(
                    f"Visual subtype: {visual_subtype}"
                )

            description = figure.get(
                "grounded_description",
                "",
            )

            if description:
                lines.append(
                    f"Grounded description: {description}"
                )

            explanation = figure.get(
                "student_explanation",
                "",
            )

            if explanation:
                lines.append(
                    f"Student explanation: {explanation}"
                )

            teaches = figure.get(
                "teaches",
                [],
            )

            if teaches:
                lines.append(
                    "Concepts taught: "
                    + ", ".join(teaches)
                )

            curriculum_topics = figure.get(
                "curriculum_topics",
                [],
            )

            if curriculum_topics:
                lines.append(
                    "Curriculum topics: "
                    + ", ".join(curriculum_topics)
                )

            learning_objectives = figure.get(
                "learning_objectives",
                [],
            )

            if learning_objectives:
                lines.append(
                    "Learning objectives: "
                    + ", ".join(
                        learning_objectives
                    )
                )

            visible_entities = figure.get(
                "visible_entities",
                [],
            )

            if visible_entities:
                lines.append(
                    "Visible entities: "
                    + ", ".join(
                        str(entity)
                        for entity in visible_entities
                    )
                )

            concept_relationships = figure.get(
                "concept_relationships",
                [],
            )

            if concept_relationships:
                lines.append(
                    "Concept relationships: "
                    + ", ".join(
                        str(relationship)
                        for relationship in concept_relationships
                    )
                )

            pedagogical_value = figure.get(
                "pedagogical_value",
                "",
            )

            if pedagogical_value:
                lines.append(
                    f"Pedagogical value: {pedagogical_value}"
                )

            sections.append(
                "\n".join(lines)
            )

        figure_context = (
            "Retrieved Textbook Figures\n"
            "==========================\n\n"
            + "\n\n------------------------------\n\n".join(
                sections
            )
        )

        if len(figure_context) > FIGURE_CONTEXT_MAX_CHARS:
            figure_context = (
                figure_context[:FIGURE_CONTEXT_MAX_CHARS]
                + "\n\n[additional figure detail truncated]"
            )

        _figure_context_cache.set(cache_key, figure_context)

        return figure_context

    # =====================================
    # PROMPT SELECTION
    # =====================================

    def _select_prompt(
            self,
            intent: Intent,
    ):

        prompt_map = {
            Intent.CHAT: QA_PROMPT,

            # Short factual / definition requests
            Intent.DEFINITION: QA_PROMPT,

            # Detailed teaching requests
            Intent.EXPLAIN: EXPLAIN_PROMPT,

            # Nudge toward the answer, never state it
            Intent.HINT: HINT_PROMPT,

            # Follow-ups should continue naturally
            # using conversation + optional memory
            Intent.FOLLOW_UP: QA_PROMPT,

            Intent.MCQ: MCQ_PROMPT,

            Intent.QUESTION_PAPER:
                QUESTION_PAPER_PROMPT,

            Intent.ANSWER_SHEET:
                ANSWER_SHEET_PROMPT,

            Intent.SUMMARY:
                SUMMARY_PROMPT,

            Intent.REVISION:
                REVISION_PROMPT,
        }

        return prompt_map.get(
            intent,
            QA_PROMPT,
        )

    # =====================================
    # MAIN ROUTER
    # =====================================
    def run(
            self,
            intent,
            question,
            context,
            subject,
            chapter,
            mode,
            figures=None,  # NEW
            conversation=None,
            memory=None,
            board="CBSE",
            standard="Standard 9",
            response_mode="text",
            image_description=None,
    ):

        with langfuse.start_as_current_observation(
                as_type="span",
                name="tutor-engine-run",
                input={
                    "intent": str(intent),
                    "question": question,
                    "subject": subject,
                    "chapter": chapter,
                    "mode": mode,
                    "board": board,
                    "standard": standard,
                    "context_chars": len(
                        str(context or "")
                    ),
                    "conversation_messages": len(
                        conversation or []
                    ),
                    "has_memory": bool(memory),
                },
        ) as run_span:

            try:

                # =============================
                # QUIZ MODE
                # =============================

                if intent == Intent.QUIZ:
                    quiz = self.generate_quiz(
                        question=question,
                        context=context,
                        subject=subject,
                        chapter=chapter,
                        num_questions=(
                            DEFAULT_QUIZ_QUESTIONS
                        ),
                        board=board,
                        standard=standard,
                    )

                    result = {
                        "type": "quiz",
                        "quiz": quiz,
                    }

                    run_span.update(
                        output={
                            "result_type": "quiz",
                            "quiz_questions": len(
                                quiz
                            ),
                        }
                    )

                    return result

                # =============================
                # NORMAL CHAT
                # =============================

                answer = self.generate(
                    intent=intent,
                    question=question,
                    context=context,
                    subject=subject,
                    chapter=chapter,
                    mode=mode,
                    conversation=conversation,
                    memory=memory,
                    board=board,
                    standard=standard,
                    response_mode=response_mode,
                    image_description=image_description,
                )

                result = {
                    "type": "chat",
                    "answer": answer,
                }

                run_span.update(
                    output={
                        "result_type": "chat",
                        "answer_chars": len(
                            answer
                        ),
                    }
                )

                return result

            except Exception as exc:

                run_span.update(
                    output={
                        "status": "failed",
                        "error_type":
                            type(exc).__name__,
                        "error": str(exc),
                    }
                )

                raise
    # =====================================
    # QUIZ GENERATION
    # =====================================

    def generate_quiz(
            self,
            question: str,
            context: str,
            subject: str,
            chapter: str,
            num_questions: int | None = None,
            board: str = "CBSE",
            standard: str = "Standard 9",
            _retry_depth: int = 0,
    ):

        total_start = time.perf_counter()

        if num_questions is None:
            num_questions = (
                DEFAULT_QUIZ_QUESTIONS
            )

        context = context[
            :RAG_CONTEXT_MAX_CHARS
        ]


        with langfuse.start_as_current_observation(
                as_type="span",
                name="quiz-generation",
                input={
                    "question": question,
                    "subject": subject,
                    "chapter": chapter,
                    "board": board,
                    "standard": standard,
                    "num_questions": num_questions,
                    "context_chars": len(context),
                },
        ) as quiz_span:

            try:

                # =============================
                # QUIZ PROMPT BUILDING
                # =============================

                prompt_start = (
                    time.perf_counter()
                )

                with (
                        langfuse
                                .start_as_current_observation(
                            as_type="span",
                            name="quiz-prompt-building",
                        )
                ) as prompt_span:

                    prompt = (
                            f"Board: {board}\n"
                            f"Standard: {standard}\n"
                            f"Subject: {subject}\n"
                            f"Chapter: {chapter}\n\n"
                            + QUIZ_PROMPT.format(
                        subject=subject,
                        chapter=chapter,
                        mode="Quiz",
                        context=context,
                        question=question,
                        num_questions=(
                            num_questions
                        ),
                        conversation="",
                        memory="",
                    )
                    )

                    prompt_span.update(
                        output={
                            "prompt_chars": len(
                                prompt
                            ),
                            "duration_seconds": (
                                    time.perf_counter()
                                    - prompt_start
                            ),
                        }
                    )

                print("=" * 60)
                print(
                    "STARTING OLLAMA QUIZ "
                    "GENERATION"
                )
                print("SUBJECT :", subject)
                print("CHAPTER :", chapter)
                print(
                    "QUESTIONS :",
                    num_questions,
                )
                print("=" * 60)

                custom_sys = (
                    SYSTEM_PROMPT.replace(
                        "CBSE Class 9",
                        f"{board} {standard}",
                    )
                )

                # OLLAMA_QUIZ_NUM_PREDICT (2500) was tuned as a flat total
                # budget against Ollama's terser local-model output at the
                # default 10 questions. Cloud providers (e.g. Gemini, now
                # the default active provider — see core/llm_provider.py)
                # write noticeably longer explanations per question, so a
                # flat 2500 truncates mid-JSON well before 10 questions
                # complete — reproduced directly: 2500 tokens for 10
                # questions cut off mid-way through question 6. Scale with
                # num_questions instead, keeping the env constant as a
                # floor so small quizzes keep their previous behavior.
                #
                # 500/question was the original fix's number, sized for
                # Gemini's normal verbosity — Practice's "Challenge Mode"
                # (see AI-Education-Backend's MODE_FOCUS) asks for harder,
                # multi-step application questions, which run noticeably
                # longer (a whole word-problem premise per question, not
                # just a sentence) and reproduced the exact same truncation
                # again at 500/question — cut off composing question 2 of
                # 5. Bumped to 800/question as a blanket margin rather than
                # a challenge-only special case: a higher cap costs nothing
                # when the model doesn't need it (generation still stops at
                # the JSON's natural end), it only prevents this class of
                # bug from recurring for any future mode/prompt that
                # happens to produce longer questions.
                quiz_num_predict = max(
                    OLLAMA_QUIZ_NUM_PREDICT,
                    num_questions * 800 + 400,
                )

                # =============================
                # OLLAMA QUIZ GENERATION
                # =============================

                quiz_ollama_start = (
                    time.perf_counter()
                )

                with (
                        langfuse
                                .start_as_current_observation(
                            as_type="generation",
                            name=(
                                    "ollama-quiz-generation"
                            ),
                            model=self.model,
                            input={
                                "question": question,
                                "prompt_chars": len(
                                    prompt
                                ),
                                "context_chars": len(
                                    context
                                ),
                            },
                            model_parameters={
                                "num_ctx":
                                    OLLAMA_NUM_CTX,
                                "num_predict":
                                    quiz_num_predict,
                                "temperature":
                                    OLLAMA_QUIZ_TEMPERATURE,
                            },
                            metadata={
                                "provider": "ollama",
                                "host": self.host,
                                "subject": subject,
                                "chapter": chapter,
                                "board": board,
                                "standard": standard,
                                "expected_questions":
                                    num_questions,
                            },
                        )
                ) as ollama_generation:

                    try:

                        response = (
                            self._chat(
                                model=self.model,
                                messages=[
                                    {
                                        "role":
                                            "system",
                                        "content":
                                            custom_sys,
                                    },
                                    {
                                        "role":
                                            "user",
                                        "content":
                                            prompt,
                                    },
                                ],
                                format={
                                    "type": "array",
                                    "items": {
                                        "type":
                                            "object",
                                        "properties": {
                                            "question": {
                                                "type":
                                                    "string"
                                            },
                                            "options": {
                                                "type":
                                                    "object",
                                                "properties": {
                                                    "A": {
                                                        "type":
                                                            "string"
                                                    },
                                                    "B": {
                                                        "type":
                                                            "string"
                                                    },
                                                    "C": {
                                                        "type":
                                                            "string"
                                                    },
                                                    "D": {
                                                        "type":
                                                            "string"
                                                    },
                                                },
                                                "required": [
                                                    "A",
                                                    "B",
                                                    "C",
                                                    "D",
                                                ],
                                            },
                                            "correct_answer": {
                                                "type":
                                                    "string",
                                                "enum": [
                                                    "A",
                                                    "B",
                                                    "C",
                                                    "D",
                                                ],
                                            },
                                            "explanation": {
                                                "type":
                                                    "string"
                                            },
                                            "concept": {
                                                "type":
                                                    "string"
                                            },
                                        },
                                        "required": [
                                            "question",
                                            "options",
                                            "correct_answer",
                                            "explanation",
                                            "concept",
                                        ],
                                    },
                                },
                                options={
                                    "num_ctx":
                                        OLLAMA_NUM_CTX,
                                    "num_predict":
                                        quiz_num_predict,
                                    "temperature":
                                        OLLAMA_QUIZ_TEMPERATURE,
                                    # Explicit random seed each call so
                                    # repeated "Start Quiz" clicks for the
                                    # same chapter don't settle into the
                                    # same sampling path.
                                    "seed":
                                        random.randint(0, 2_147_483_647),
                                },
                            )
                        )

                        content = str(
                            response[
                                "message"
                            ]["content"]
                            or ""
                        )

                        ollama_generation.update(
                            output={
                                "response_chars": len(
                                    content
                                ),
                                "duration_seconds": (
                                        time.perf_counter()
                                        - quiz_ollama_start
                                ),
                            }
                        )

                    except Exception as exc:

                        ollama_generation.update(
                            output={
                                "status": "failed",
                                "error_type":
                                    type(exc)
                                    .__name__,
                                "error": str(exc),
                                "duration_seconds": (
                                        time.perf_counter()
                                        - quiz_ollama_start
                                ),
                            }
                        )

                        raise

                print(
                    f"[PERF] Quiz Ollama "
                    f"generation: "
                    f"{time.perf_counter() - quiz_ollama_start:.3f}s"
                )

                print("=" * 60)
                print(
                    "OLLAMA QUIZ RESPONSE "
                    "RECEIVED"
                )
                print("=" * 60)

                # =============================
                # JSON PARSING
                # =============================

                parse_start = (
                    time.perf_counter()
                )

                with (
                        langfuse
                                .start_as_current_observation(
                            as_type="span",
                            name="quiz-json-parsing",
                            input={
                                "response_chars": len(
                                    content
                                ),
                            },
                        )
                ) as parse_span:

                    try:

                        quiz_data = json.loads(
                            content
                        )

                        parse_span.update(
                            output={
                                "status":
                                    "success",
                                "parsed_questions":
                                    len(quiz_data),
                                "duration_seconds": (
                                        time.perf_counter()
                                        - parse_start
                                ),
                            }
                        )

                    except json.JSONDecodeError as exc:

                        parse_span.update(
                            output={
                                "status":
                                    "failed",
                                "error_type":
                                    type(exc)
                                    .__name__,
                                "error":
                                    str(exc),
                                "error_line":
                                    exc.lineno,
                                "error_column":
                                    exc.colno,
                                "error_position":
                                    exc.pos,
                                "response_chars":
                                    len(content),
                                "duration_seconds": (
                                        time.perf_counter()
                                        - parse_start
                                ),
                            }
                        )

                        raise ValueError(
                            "Ollama returned invalid "
                            "quiz JSON.\n\n"
                            f"Output:\n{content}"
                        ) from exc

                # =============================
                # BUILD QUIZ OBJECTS
                # =============================

                questions = []

                for item in quiz_data:
                    question_obj = (
                        QuizQuestion(
                            question=(
                                item["question"]
                            ),
                            options=(
                                item["options"]
                            ),
                            correct_answer=(
                                item[
                                    "correct_answer"
                                ]
                            ),
                            explanation=(
                                    item.get(
                                        "explanation"
                                    )
                                    or
                                    "Review the relevant "
                                    "concept from this "
                                    "chapter."
                            ),
                            concept=(
                                item.get("concept") or ""
                            ),
                        )
                    )

                    questions.append(
                        question_obj
                    )

                result = [
                    {
                        "question":
                            q.question,
                        "options":
                            q.options,
                        "correct_answer":
                            q.correct_answer,
                        "explanation":
                            q.explanation,
                        "concept":
                            q.concept,
                    }
                    for q in questions
                ]

                quiz_span.update(
                    output={
                        "status": "completed",
                        "generated_questions": len(
                            result
                        ),
                        "duration_seconds": (
                                time.perf_counter()
                                - total_start
                        ),
                    }
                )

                if (
                        len(result) < num_questions
                        and _retry_depth < MAX_QUIZ_GENERATION_RETRIES
                ):
                    print(
                        f"[quiz] under-generated: got {len(result)}/"
                        f"{num_questions} questions — retrying "
                        f"(attempt {_retry_depth + 1}/"
                        f"{MAX_QUIZ_GENERATION_RETRIES})"
                    )
                    return self.generate_quiz(
                        question,
                        context,
                        subject,
                        chapter,
                        num_questions=num_questions,
                        board=board,
                        standard=standard,
                        _retry_depth=_retry_depth + 1,
                    )

                return result

            except Exception as exc:

                quiz_span.update(
                    output={
                        "status": "failed",
                        "error_type":
                            type(exc).__name__,
                        "error": str(exc),
                        "duration_seconds": (
                                time.perf_counter()
                                - total_start
                        ),
                    }
                )

                raise

    # =====================================
    # FLASHCARD GENERATION
    # =====================================

    def generate_flashcards(
        self,
        context,
        subject,
        chapter,
        num_cards=None,
        board="CBSE",
        standard="Standard 9",
    ):
        if num_cards is None:
            num_cards = DEFAULT_FLASHCARD_COUNT

        context = context[:RAG_CONTEXT_MAX_CHARS]

        with langfuse.start_as_current_observation(
            as_type="span",
            name="flashcard-generation",
            input={
                "subject": subject,
                "chapter": chapter,
                "board": board,
                "standard": standard,
                "num_cards": num_cards,
                "context_chars": len(context),
            },
        ) as flashcard_span:
            try:
                custom_sys = SYSTEM_PROMPT.replace("CBSE Class 9", f"{board} {standard}")

                prompt = (
                    f"Board: {board}\n"
                    f"Standard: {standard}\n"
                    f"Subject: {subject}\n"
                    f"Chapter: {chapter}\n\n"
                    + FLASHCARD_PROMPT.format(
                        subject=subject,
                        chapter=chapter,
                        context=context,
                        num_cards=num_cards,
                    )
                )

                flashcard_ollama_start = time.perf_counter()

                with langfuse.start_as_current_observation(
                    as_type="generation",
                    name="ollama-flashcard-generation",
                    model=self.model,
                    input={"prompt_chars": len(prompt), "context_chars": len(context)},
                    model_parameters={
                        "num_ctx": OLLAMA_NUM_CTX,
                        "num_predict": OLLAMA_FLASHCARD_NUM_PREDICT,
                        "temperature": OLLAMA_FLASHCARD_TEMPERATURE,
                    },
                    metadata={
                        "provider": "ollama",
                        "host": self.host,
                        "subject": subject,
                        "chapter": chapter,
                        "board": board,
                        "standard": standard,
                        "expected_cards": num_cards,
                    },
                ) as ollama_generation:
                    try:
                        response = self._chat(
                            model=self.model,
                            messages=[
                                {"role": "system", "content": custom_sys},
                                {"role": "user", "content": prompt},
                            ],
                            format={
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "front": {"type": "string"},
                                        "back": {"type": "string"},
                                    },
                                    "required": ["front", "back"],
                                },
                            },
                            options={
                                "num_ctx": OLLAMA_NUM_CTX,
                                "num_predict": OLLAMA_FLASHCARD_NUM_PREDICT,
                                "temperature": OLLAMA_FLASHCARD_TEMPERATURE,
                                # Same fix as quiz generation: an explicit
                                # random seed each call so repeated
                                # generations for a chapter actually differ.
                                "seed": random.randint(0, 2_147_483_647),
                            },
                        )

                        content = str(response["message"]["content"] or "")

                        ollama_generation.update(
                            output={
                                "response_chars": len(content),
                                "duration_seconds": time.perf_counter() - flashcard_ollama_start,
                            }
                        )
                    except Exception as exc:
                        ollama_generation.update(
                            output={
                                "status": "failed",
                                "error_type": type(exc).__name__,
                                "error": str(exc),
                                "duration_seconds": time.perf_counter() - flashcard_ollama_start,
                            }
                        )
                        raise

                try:
                    cards_data = json.loads(content)
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"Ollama returned invalid flashcard JSON.\n\nOutput:\n{content}"
                    ) from exc

                result = [
                    {"front": item["front"], "back": item["back"]}
                    for item in cards_data
                    if item.get("front") and item.get("back")
                ]

                flashcard_span.update(
                    output={
                        "status": "completed",
                        "generated_cards": len(result),
                        "duration_seconds": time.perf_counter() - flashcard_ollama_start,
                    }
                )

                return result

            except Exception as exc:
                flashcard_span.update(
                    output={"status": "failed", "error_type": type(exc).__name__, "error": str(exc)}
                )
                raise

    def draft_sample_paper_answer(self, question_text: str, max_marks: int, context: str):
        """Sample Papers Stage 0 fallback — drafts a model answer + rubric
        for a question extraction couldn't match to its real Solution
        entry. Never the primary path (see prompts.py's module docstring
        for SAMPLE_PAPER_ANSWER_DRAFT_PROMPT); every question, matched or
        drafted, still goes through admin review before publish. Fails
        safe (empty answer, empty rubric) on unparseable output rather
        than raising — one bad draft shouldn't block the caller from
        reviewing the rest of the paper."""
        context = context[:RAG_CONTEXT_MAX_CHARS]
        prompt = SAMPLE_PAPER_ANSWER_DRAFT_PROMPT.format(
            question_text=question_text,
            max_marks=max_marks,
            context=context,
        )

        try:
            response = self._chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                format={
                    "type": "object",
                    "properties": {
                        "model_answer": {"type": "string"},
                        "rubric_criteria": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "criterion": {"type": "string"},
                                    "marks": {"type": "number"},
                                },
                                "required": ["criterion", "marks"],
                            },
                        },
                    },
                    "required": ["model_answer", "rubric_criteria"],
                },
                options={"num_ctx": OLLAMA_NUM_CTX, "temperature": OLLAMA_TEMPERATURE},
            )
            content = str(response["message"]["content"] or "")
            data = json.loads(content)
            return {
                "model_answer": data.get("model_answer") or "",
                "rubric_criteria": data.get("rubric_criteria") or [],
            }
        except Exception:
            logger.exception("draft_sample_paper_answer failed")
            return {"model_answer": "", "rubric_criteria": []}

    def grade_text_answer(
        self,
        *,
        question_text: str,
        max_marks: int,
        model_answer: str,
        rubric_criteria: list[dict],
        student_answer: str,
    ) -> dict:
        """Stage 2 grading — grades one already-transcribed student answer
        (core/sample_paper_grading.py has already done the one
        vision-dependent step, reading the handwriting) against the
        question's REAL model_answer/rubric_criteria, text-only. Fails
        safe to a zero-score, low-confidence result on unparseable output
        rather than raising — one bad grading call must not abort grading
        the rest of the attempt (mirrors draft_sample_paper_answer's own
        fail-safe contract, and sample_paper_extraction.py's page-level
        fail-safe convention)."""
        from core.prompts import SAMPLE_PAPER_GRADE_ANSWER_PROMPT

        rubric_text = (
            "\n".join(f"- {c.get('criterion', '')}: {c.get('marks', 0)} mark(s)" for c in rubric_criteria)
            if rubric_criteria
            else "(no structured rubric provided — grade holistically against the model answer)"
        )
        prompt = SAMPLE_PAPER_GRADE_ANSWER_PROMPT.format(
            question_text=question_text,
            max_marks=max_marks,
            model_answer=model_answer,
            rubric_criteria=rubric_text,
            student_answer=student_answer,
        )

        try:
            response = self._chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                format={
                    "type": "object",
                    "properties": {
                        "rubric_breakdown": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "criterion": {"type": "string"},
                                    "marks_possible": {"type": "number"},
                                    "marks_awarded": {"type": "number"},
                                    "comment": {"type": "string"},
                                },
                                "required": ["criterion", "marks_possible", "marks_awarded"],
                            },
                        },
                        "marks_awarded": {"type": "number"},
                        "feedback": {"type": "string"},
                        "internal_notes": {"type": "string"},
                        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    },
                    "required": ["marks_awarded", "feedback", "confidence"],
                },
                options={"num_ctx": OLLAMA_NUM_CTX, "temperature": OLLAMA_TEMPERATURE},
            )
            content = str(response["message"]["content"] or "")
            data = json.loads(content)

            marks_awarded = data.get("marks_awarded", 0)
            try:
                marks_awarded = max(0, min(float(marks_awarded), float(max_marks)))
            except (TypeError, ValueError):
                marks_awarded = 0

            return {
                "rubric_breakdown": data.get("rubric_breakdown") or [],
                "marks_awarded": marks_awarded,
                "feedback": data.get("feedback") or "",
                "internal_notes": data.get("internal_notes") or "",
                "confidence": data.get("confidence") if data.get("confidence") in ("high", "medium", "low") else "low",
            }
        except Exception:
            logger.exception("grade_text_answer failed")
            return {
                "rubric_breakdown": [],
                "marks_awarded": 0,
                "feedback": "This answer could not be graded automatically — please review it yourself against the model answer.",
                "internal_notes": "grade_text_answer raised an exception; see server logs.",
                "confidence": "low",
            }

    # =====================================
    # MIND MAP GENERATION
    # =====================================

    @staticmethod
    def _resolve_node_citation(node, chunks):
        """Shared by branches, children, and grandchildren — pops the
        model-named "evidence_block" index (1-indexed into `chunks`,
        never trusted as anything but a number) and resolves it to the
        real source/page/chapter metadata, attached as "citation". Also
        applies the "type" defensive fallback (the schema's enum already
        constrains this, but a model that ignores the schema, or an
        older cached response shape, shouldn't crash the frontend's
        type-based styling on a missing field).

        "content_type" (from the chunk's full raw payload — "ncert_notes"
        / "ncert_solution" / absent for raw chapter-PDF content, see
        scripts/ingest_ncert_solutions.py) is what lets the frontend route
        a citation click to the RIGHT document in the reader — NCERT
        Notes/Solutions are entirely separate PDFs from the raw chapter
        textbook, with their own page numbering. Citations mostly resolve
        into Notes/Solutions content in practice, so without this the
        frontend was applying a Notes/Solutions page number to the raw
        chapter PDF's page state — landing on the right chapter, wrong
        (unrelated) page, every time."""
        node.setdefault("type", "concept")
        index = node.pop("evidence_block", 0)
        chunk = chunks[index - 1] if isinstance(index, int) and 1 <= index <= len(chunks) else None
        node["citation"] = (
            {
                "source": chunk.get("source") or None,
                "page": chunk.get("page"),
                "chapter": chunk.get("chapter"),
                "content_type": (chunk.get("payload") or {}).get("content_type"),
            }
            if chunk
            else None
        )

    def generate_mind_map(self, chunks, subject, chapter, variant="concept_overview"):
        """A grounded mind map (central topic -> 6-10 branches -> 3-6
        children each), organized through one of MIND_MAP_LENS_INSTRUCTIONS'
        pedagogical lenses (`variant`) — same retrieved evidence, different
        organizing principle, so pre-generating all 5 variants gives a
        genuinely different way to see the chapter each time, not 5
        re-rolls of the same structure. `chunks` is the real retrieved
        evidence (list of dicts with text/source/page/chapter, see
        vector_db.py's search()) — presented to the model as numbered
        blocks, and every branch/child is required to name which block
        it's grounded in ("evidence_block"), resolved server-side to real
        source/page metadata via _resolve_node_citation (never trusted
        from the model directly). Each branch/child also gets a "type"
        (concept/definition/example/formula/common_mistake/
        related_concept), schema-constrained via an enum, for the
        frontend to style differently. Raises on failure; the Node
        backend already treats mind-map generation the same way it
        treats quiz/flashcard generation (surfaces a real error to the
        student rather than faking a map).

        IMPORTANT — mixed failure posture: branches+children (this call)
        still raise on failure as before. "relationships" (a SECOND,
        separate Ollama call made after branches are known — see
        _generate_mind_map_relationships) SOFT-FAILS to an empty list on
        any error instead of raising. A THIRD level (grandchildren) is
        NOT generated here at all — see main.py's
        _expand_concept_overview_depth, which is only ever invoked for
        the "concept_overview" variant and does its own per-node
        retrieval, so it can't live inside this chunks-only method."""
        numbered_context = "\n\n".join(
            f"[{i}] {chunk['text']}" for i, chunk in enumerate(chunks, start=1)
        )

        lens_instruction = MIND_MAP_LENS_INSTRUCTIONS.get(
            variant, MIND_MAP_LENS_INSTRUCTIONS["concept_overview"]
        )

        with langfuse.start_as_current_observation(
            as_type="generation",
            name="mindmap-generation",
            model=self.model,
            input={
                "subject": subject,
                "chapter": chapter,
                "variant": variant,
                "context_chars": len(numbered_context),
            },
            model_parameters={
                "num_ctx": OLLAMA_NUM_CTX,
                "num_predict": OLLAMA_MINDMAP_NUM_PREDICT,
                "temperature": OLLAMA_MINDMAP_TEMPERATURE,
            },
        ) as mindmap_span:
            custom_sys = SYSTEM_PROMPT.replace("CBSE Class 9", "CBSE Standard 9")

            prompt = MIND_MAP_PROMPT.format(
                subject=subject, chapter=chapter, context=numbered_context, lens_instruction=lens_instruction
            )

            node_type_enum = [
                "concept",
                "definition",
                "example",
                "formula",
                "common_mistake",
                "related_concept",
            ]
            child_schema = {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "type": {"type": "string", "enum": node_type_enum},
                    "description": {"type": "string"},
                    "evidence_block": {"type": "integer"},
                },
                "required": ["label", "type", "description", "evidence_block"],
            }

            response = self._chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": custom_sys},
                    {"role": "user", "content": prompt},
                ],
                format={
                    "type": "object",
                    "properties": {
                        "central_topic": {"type": "string"},
                        "branches": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {"type": "string"},
                                    "type": {"type": "string", "enum": node_type_enum},
                                    "description": {"type": "string"},
                                    "children": {"type": "array", "items": child_schema},
                                    "evidence_block": {"type": "integer"},
                                },
                                "required": ["label", "type", "description", "children", "evidence_block"],
                            },
                        },
                    },
                    "required": ["central_topic", "branches"],
                },
                options={
                    "num_ctx": OLLAMA_NUM_CTX,
                    "num_predict": OLLAMA_MINDMAP_NUM_PREDICT,
                    "temperature": OLLAMA_MINDMAP_TEMPERATURE,
                    "seed": random.randint(0, 2_147_483_647),
                },
            )

            content = str(response["message"]["content"] or "").strip()

            try:
                mind_map = json.loads(content)
            except json.JSONDecodeError as exc:
                mindmap_span.update(output={"status": "failed", "error": str(exc)})
                raise ValueError(f"Ollama returned invalid mind map JSON.\n\nOutput:\n{content}") from exc

            branches = mind_map.get("branches", [])
            for branch in branches:
                self._resolve_node_citation(branch, chunks)
                children = branch.get("children") or []
                branch["children"] = children
                for child in children:
                    self._resolve_node_citation(child, chunks)
                    # Grandchildren, if any, are attached later by
                    # main.py's _expand_concept_overview_depth — starts
                    # empty so the shape is uniform across all 5 variants
                    # regardless of whether this node ever gets expanded.
                    child["children"] = []

            mind_map["relationships"] = self._generate_mind_map_relationships(
                chunks=chunks,
                subject=subject,
                chapter=chapter,
                branches=branches,
                numbered_context=numbered_context,
            )

            mindmap_span.update(
                output={
                    "status": "completed",
                    "branch_count": len(branches),
                    "relationship_count": len(mind_map["relationships"]),
                }
            )

            return mind_map

    def _generate_mind_map_relationships(self, chunks, subject, chapter, branches, numbered_context):
        """Second, separate Ollama call for generate_mind_map — see that
        method's docstring for why this is split out rather than combined
        into the same call. Soft-fails to [] on any error (logged, never
        raised) since this is additive content, not the mind map's
        load-bearing structure."""
        if not branches:
            return []

        branch_list = "\n".join(
            f"{i}. [{branch.get('type', 'concept')}] {branch.get('label', '')}"
            for i, branch in enumerate(branches, start=1)
        )

        try:
            with langfuse.start_as_current_observation(
                as_type="generation",
                name="mindmap-relationships-generation",
                model=self.model,
                input={"subject": subject, "chapter": chapter, "branch_count": len(branches)},
                model_parameters={
                    "num_ctx": OLLAMA_NUM_CTX,
                    "num_predict": OLLAMA_MINDMAP_RELATIONSHIPS_NUM_PREDICT,
                    "temperature": OLLAMA_MINDMAP_TEMPERATURE,
                },
            ) as relationships_span:
                custom_sys = SYSTEM_PROMPT.replace("CBSE Class 9", "CBSE Standard 9")

                prompt = MIND_MAP_RELATIONSHIPS_PROMPT.format(
                    subject=subject,
                    chapter=chapter,
                    context=numbered_context,
                    branch_count=len(branches),
                    branch_list=branch_list,
                )

                response = self._chat(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": custom_sys},
                        {"role": "user", "content": prompt},
                    ],
                    format={
                        "type": "object",
                        "properties": {
                            "relationships": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "from_branch_index": {"type": "integer"},
                                        "to_branch_index": {"type": "integer"},
                                        "relationship": {
                                            "type": "string",
                                            "enum": [
                                                "causes",
                                                "depends_on",
                                                "related_to",
                                                "contrasts_with",
                                                "part_of",
                                            ],
                                        },
                                        "reason": {"type": "string"},
                                        "evidence_block": {"type": "integer"},
                                    },
                                    "required": [
                                        "from_branch_index",
                                        "to_branch_index",
                                        "relationship",
                                        "reason",
                                        "evidence_block",
                                    ],
                                },
                            },
                        },
                        "required": ["relationships"],
                    },
                    options={
                        "num_ctx": OLLAMA_NUM_CTX,
                        "num_predict": OLLAMA_MINDMAP_RELATIONSHIPS_NUM_PREDICT,
                        "temperature": OLLAMA_MINDMAP_TEMPERATURE,
                        "seed": random.randint(0, 2_147_483_647),
                    },
                )

                content = str(response["message"]["content"] or "").strip()
                parsed = json.loads(content)

                relationships = []
                for rel in parsed.get("relationships", []):
                    from_idx = rel.get("from_branch_index")
                    to_idx = rel.get("to_branch_index")
                    # Server-side validation, same discipline as branch
                    # citations — never trust an index from the model
                    # without checking it's actually in range.
                    if not (isinstance(from_idx, int) and 1 <= from_idx <= len(branches)):
                        continue
                    if not (isinstance(to_idx, int) and 1 <= to_idx <= len(branches)):
                        continue
                    if from_idx == to_idx:
                        continue

                    evidence_index = rel.get("evidence_block", 0)
                    chunk = (
                        chunks[evidence_index - 1]
                        if isinstance(evidence_index, int) and 1 <= evidence_index <= len(chunks)
                        else None
                    )
                    relationships.append({
                        "from_branch_index": from_idx,
                        "to_branch_index": to_idx,
                        "relationship": rel.get("relationship", "related_to"),
                        "reason": rel.get("reason", ""),
                        "citation": (
                            {
                                "source": chunk.get("source") or None,
                                "page": chunk.get("page"),
                                "chapter": chunk.get("chapter"),
                                "content_type": (chunk.get("payload") or {}).get("content_type"),
                            }
                            if chunk
                            else None
                        ),
                    })

                relationships_span.update(
                    output={"status": "completed", "relationship_count": len(relationships)}
                )
                return relationships
        except Exception:
            logger.exception("Mind map relationship generation failed — soft-failing to an empty list")
            return []

    def generate_node_children(self, chunks, subject, chapter, node_label, node_type):
        """Third mind-map level (grandchildren) — only ever called by
        main.py's _expand_concept_overview_depth, for the "concept_overview"
        variant, and only for a level-2 node whose own targeted retrieval
        (done by the caller, not here — see mindmap_retrieval.py's
        retrieve_node_context) turned up enough real evidence to justify
        going deeper. `chunks` here is that small, node-scoped evidence
        set, not the whole chapter's context. Soft-fails to [] on any
        error, same posture as relationships — a single node's expansion
        failing should never break the rest of the mind map."""
        if not chunks:
            return []

        numbered_context = "\n\n".join(
            f"[{i}] {chunk['text']}" for i, chunk in enumerate(chunks, start=1)
        )

        try:
            with langfuse.start_as_current_observation(
                as_type="generation",
                name="mindmap-node-children-generation",
                model=self.model,
                input={"subject": subject, "chapter": chapter, "node_label": node_label},
                model_parameters={
                    "num_ctx": OLLAMA_NUM_CTX,
                    "num_predict": OLLAMA_MINDMAP_CHILDREN_NUM_PREDICT,
                    "temperature": OLLAMA_MINDMAP_TEMPERATURE,
                },
            ) as children_span:
                custom_sys = SYSTEM_PROMPT.replace("CBSE Class 9", "CBSE Standard 9")

                prompt = MIND_MAP_GRANDCHILDREN_PROMPT.format(
                    subject=subject,
                    chapter=chapter,
                    node_label=node_label,
                    node_type=node_type,
                    context=numbered_context,
                )

                response = self._chat(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": custom_sys},
                        {"role": "user", "content": prompt},
                    ],
                    format={
                        "type": "object",
                        "properties": {
                            "children": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "label": {"type": "string"},
                                        "type": {
                                            "type": "string",
                                            "enum": [
                                                "concept",
                                                "definition",
                                                "example",
                                                "formula",
                                                "common_mistake",
                                                "related_concept",
                                            ],
                                        },
                                        "description": {"type": "string"},
                                        "evidence_block": {"type": "integer"},
                                    },
                                    "required": ["label", "type", "description", "evidence_block"],
                                },
                            },
                        },
                        "required": ["children"],
                    },
                    options={
                        "num_ctx": OLLAMA_NUM_CTX,
                        "num_predict": OLLAMA_MINDMAP_CHILDREN_NUM_PREDICT,
                        "temperature": OLLAMA_MINDMAP_TEMPERATURE,
                        "seed": random.randint(0, 2_147_483_647),
                    },
                )

                content = str(response["message"]["content"] or "").strip()
                parsed = json.loads(content)

                grandchildren = parsed.get("children", [])
                for grandchild in grandchildren:
                    self._resolve_node_citation(grandchild, chunks)
                    # Depth caps at 3 levels total (branch -> child ->
                    # grandchild) — a grandchild never gets its own
                    # further-nested children.
                    grandchild["children"] = []

                children_span.update(
                    output={"status": "completed", "child_count": len(grandchildren)}
                )
                return grandchildren
        except Exception:
            logger.exception("Mind map node-children generation failed for node=%r — soft-failing to []", node_label)
            return []

    # =====================================
    # AI LEARNING DECK GENERATION (Phase 1)
    # =====================================

    def generate_slide_deck(self, chunks, subject, chapter):
        """Phase 1 AI Learning Deck — a single grounded, purpose-driven
        slide sequence (RAG decides the story, not a fixed template): the
        same numbered-evidence-block approach as generate_mind_map, one
        structured-output call using the explicit FLAT per-slide schema
        from SLIDE_DECK_PROMPT (same field set on every slide regardless
        of type — validated more reliable for this local model than a
        polymorphic schema, the same lesson MIND_MAP_PROMPT's own schema
        already encodes). Each slide's evidence_block is resolved to a
        real citation via the same _resolve_node_citation staticmethod
        mind-map branches/children use — a slide is structurally close
        enough to a mind-map node for direct reuse. Raises on failure;
        Node's slide_deck_service.js already treats generation the same
        way it treats mind-map/quiz/flashcard generation — a real error
        surfaces rather than faking a deck."""
        numbered_context = "\n\n".join(
            f"[{i}] {chunk['text']}" for i, chunk in enumerate(chunks, start=1)
        )

        with langfuse.start_as_current_observation(
            as_type="generation",
            name="slide-deck-generation",
            model=self.model,
            input={
                "subject": subject,
                "chapter": chapter,
                "context_chars": len(numbered_context),
            },
            model_parameters={
                "num_ctx": OLLAMA_SLIDE_DECK_NUM_CTX,
                "num_predict": OLLAMA_SLIDE_DECK_NUM_PREDICT,
                "temperature": OLLAMA_SLIDE_DECK_TEMPERATURE,
            },
        ) as deck_span:
            custom_sys = SYSTEM_PROMPT.replace("CBSE Class 9", "CBSE Standard 9")

            prompt = SLIDE_DECK_PROMPT.format(subject=subject, chapter=chapter, context=numbered_context)

            slide_type_enum = ["hook", "concept", "diagram", "worked_example", "question", "recap"]
            options_schema = {
                "type": "object",
                "properties": {
                    "A": {"type": "string"},
                    "B": {"type": "string"},
                    "C": {"type": "string"},
                    "D": {"type": "string"},
                },
                "required": ["A", "B", "C", "D"],
            }
            # Flat like every other field here — "data" always carries
            # BOTH possible sub-fields (default empty/[]) rather than a
            # shape that varies by "kind", matching the same "flat, not
            # polymorphic" schema choice already validated for this
            # local model elsewhere in this file. Never treated as
            # evidence (no citation attached) — see SLIDE_DECK_PROMPT's
            # own "visual" guidance for the real-figure-first,
            # generated-diagram-fallback ordering.
            visual_schema = {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["none", "quadrant_diagram", "axis_plot"]},
                    "data": {
                        "type": "object",
                        "properties": {
                            "highlight_quadrant": {"type": "string"},
                            "points": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "label": {"type": "string"},
                                        "x": {"type": "number"},
                                        "y": {"type": "number"},
                                    },
                                    "required": ["label", "x", "y"],
                                },
                            },
                        },
                        "required": ["highlight_quadrant", "points"],
                    },
                },
                "required": ["kind", "data"],
            }

            slide_schema = {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "type": {"type": "string", "enum": slide_type_enum},
                    "heading": {"type": "string"},
                    "subheading": {"type": "string"},
                    "key_points": {"type": "array", "items": {"type": "string"}},
                    "explanation": {"type": "string"},
                    "steps": {"type": "array", "items": {"type": "string"}},
                    "question": {"type": "string"},
                    "options": options_schema,
                    "correct_answer": {"type": "string"},
                    "explanation_after_answer": {"type": "string"},
                    "image_required": {"type": "boolean"},
                    "visual_query": {"type": "string"},
                    "visual": visual_schema,
                    "evidence_block": {"type": "integer"},
                },
                "required": [
                    "id",
                    "type",
                    "heading",
                    "subheading",
                    "key_points",
                    "explanation",
                    "steps",
                    "question",
                    "options",
                    "correct_answer",
                    "explanation_after_answer",
                    "image_required",
                    "visual_query",
                    "visual",
                    "evidence_block",
                ],
            }

            response = self._chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": custom_sys},
                    {"role": "user", "content": prompt},
                ],
                format={
                    "type": "object",
                    "properties": {
                        "slides": {"type": "array", "items": slide_schema},
                    },
                    "required": ["slides"],
                },
                options={
                    "num_ctx": OLLAMA_SLIDE_DECK_NUM_CTX,
                    "num_predict": OLLAMA_SLIDE_DECK_NUM_PREDICT,
                    "temperature": OLLAMA_SLIDE_DECK_TEMPERATURE,
                    "seed": random.randint(0, 2_147_483_647),
                },
            )

            content = str(response["message"]["content"] or "").strip()

            try:
                deck_data = json.loads(content)
            except json.JSONDecodeError as exc:
                deck_span.update(output={"status": "failed", "error": str(exc)})
                raise ValueError(f"Ollama returned invalid slide deck JSON.\n\nOutput:\n{content}") from exc

            slides = deck_data.get("slides", [])
            for slide in slides:
                if isinstance(slide.get("key_points"), list):
                    slide["key_points"] = [kp for kp in slide["key_points"] if isinstance(kp, str) and kp.strip()]
                if isinstance(slide.get("steps"), list):
                    slide["steps"] = [st for st in slide["steps"] if isinstance(st, str) and st.strip()]

                if slide.get("type") == "question":
                    # A "question" slide whose correct_answer doesn't
                    # name a real, non-empty option is unusable —
                    # cleared here rather than shown broken;
                    # validate_slide_deck (below) is what surfaces this
                    # for visibility, this is just the deterministic
                    # safety net.
                    options = slide.get("options") or {}
                    answer = slide.get("correct_answer")
                    if answer not in options or not options.get(answer):
                        slide["correct_answer"] = None
                self._resolve_node_citation(slide, chunks)

            deck = {"slides": slides}

            deck_span.update(output={"status": "completed", "slide_count": len(slides)})

            return deck

    def generate_infographic(self, chunks, subject, chapter):
        """A single-page, whole-chapter overview — same numbered-evidence-
        block approach as generate_slide_deck/generate_mind_map, one
        structured-output call using INFOGRAPHIC_PROMPT's fixed-section
        schema (chapter_title/big_picture/key_concepts/formulas/
        definitions/common_mistakes/exam_tips/quick_recap). Every
        key_concepts/formulas/definitions/common_mistakes item's
        evidence_block is resolved to a real citation via the same
        _resolve_node_citation staticmethod slides/mind-map nodes already
        use — an infographic item is structurally close enough to a
        slide for direct reuse. Raises on failure; Node's
        infographic_service.js treats generation the same way
        slide_deck_service.js treats slide-deck generation — a real
        error surfaces rather than faking an infographic."""
        numbered_context = "\n\n".join(
            f"[{i}] {chunk['text']}" for i, chunk in enumerate(chunks, start=1)
        )

        with langfuse.start_as_current_observation(
            as_type="generation",
            name="infographic-generation",
            model=self.model,
            input={
                "subject": subject,
                "chapter": chapter,
                "context_chars": len(numbered_context),
            },
            model_parameters={
                "num_ctx": OLLAMA_INFOGRAPHIC_NUM_CTX,
                "num_predict": OLLAMA_INFOGRAPHIC_NUM_PREDICT,
                "temperature": OLLAMA_INFOGRAPHIC_TEMPERATURE,
            },
        ) as infographic_span:
            custom_sys = SYSTEM_PROMPT.replace("CBSE Class 9", "CBSE Standard 9")

            prompt = INFOGRAPHIC_PROMPT.format(subject=subject, chapter=chapter, context=numbered_context)

            # Flat per-item schema (same "flat, not polymorphic" choice
            # validated for this local model elsewhere in this file) —
            # visual_schema reused verbatim from generate_slide_deck.
            visual_schema = {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["none", "quadrant_diagram", "axis_plot"]},
                    "data": {
                        "type": "object",
                        "properties": {
                            "highlight_quadrant": {"type": "string"},
                            "points": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "label": {"type": "string"},
                                        "x": {"type": "number"},
                                        "y": {"type": "number"},
                                    },
                                    "required": ["label", "x", "y"],
                                },
                            },
                        },
                        "required": ["highlight_quadrant", "points"],
                    },
                },
                "required": ["kind", "data"],
            }

            concept_schema = {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "image_required": {"type": "boolean"},
                    "visual_query": {"type": "string"},
                    "visual": visual_schema,
                    "evidence_block": {"type": "integer"},
                },
                "required": ["title", "summary", "image_required", "visual_query", "visual", "evidence_block"],
            }
            formula_schema = {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "expression": {"type": "string"},
                    "when_to_use": {"type": "string"},
                    "evidence_block": {"type": "integer"},
                },
                "required": ["name", "expression", "when_to_use", "evidence_block"],
            }
            definition_schema = {
                "type": "object",
                "properties": {
                    "term": {"type": "string"},
                    "meaning": {"type": "string"},
                    "evidence_block": {"type": "integer"},
                },
                "required": ["term", "meaning", "evidence_block"],
            }
            mistake_schema = {
                "type": "object",
                "properties": {
                    "mistake": {"type": "string"},
                    "correction": {"type": "string"},
                    "evidence_block": {"type": "integer"},
                },
                "required": ["mistake", "correction", "evidence_block"],
            }

            response = self._chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": custom_sys},
                    {"role": "user", "content": prompt},
                ],
                format={
                    "type": "object",
                    "properties": {
                        "chapter_title": {"type": "string"},
                        "big_picture": {"type": "string"},
                        "key_concepts": {"type": "array", "items": concept_schema},
                        "formulas": {"type": "array", "items": formula_schema},
                        "definitions": {"type": "array", "items": definition_schema},
                        "common_mistakes": {"type": "array", "items": mistake_schema},
                        "exam_tips": {"type": "array", "items": {"type": "string"}},
                        "quick_recap": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": [
                        "chapter_title",
                        "big_picture",
                        "key_concepts",
                        "formulas",
                        "definitions",
                        "common_mistakes",
                        "exam_tips",
                        "quick_recap",
                    ],
                },
                options={
                    "num_ctx": OLLAMA_INFOGRAPHIC_NUM_CTX,
                    "num_predict": OLLAMA_INFOGRAPHIC_NUM_PREDICT,
                    "temperature": OLLAMA_INFOGRAPHIC_TEMPERATURE,
                    "seed": random.randint(0, 2_147_483_647),
                },
            )

            content = str(response["message"]["content"] or "").strip()

            try:
                infographic = json.loads(content)
            except json.JSONDecodeError as exc:
                infographic_span.update(output={"status": "failed", "error": str(exc)})
                raise ValueError(f"Ollama returned invalid infographic JSON.\n\nOutput:\n{content}") from exc

            for section in ("key_concepts", "formulas", "definitions", "common_mistakes"):
                for item in infographic.get(section) or []:
                    self._resolve_node_citation(item, chunks)

            infographic_span.update(
                output={"status": "completed", "key_concept_count": len(infographic.get("key_concepts") or [])}
            )

            return infographic

    # =====================================
    # STUDY PLAN INTRO
    # =====================================

    def generate_study_plan_intro(
        self,
        overall_mastery,
        total_chapters,
        chapters_completed,
        weakest_chapter=None,
        weakest_mastery=None,
        not_started_count=0,
    ):
        """A short, real-numbers-only intro for the student's study plan.
        Raises on failure — study_plan_service.js on the Node side already
        treats this as best-effort and falls back to no intro, so this
        method doesn't need its own silent fallback."""
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="study-plan-intro",
            model=self.model,
            input={
                "overall_mastery": overall_mastery,
                "total_chapters": total_chapters,
                "chapters_completed": chapters_completed,
                "weakest_chapter": weakest_chapter,
                "not_started_count": not_started_count,
            },
            model_parameters={
                "num_ctx": OLLAMA_NUM_CTX,
                "num_predict": OLLAMA_STUDY_PLAN_NUM_PREDICT,
                "temperature": OLLAMA_STUDY_PLAN_TEMPERATURE,
            },
        ) as intro_span:
            prompt = STUDY_PLAN_INTRO_PROMPT.format(
                overall_mastery=overall_mastery,
                total_chapters=total_chapters,
                chapters_completed=chapters_completed,
                weakest_chapter=weakest_chapter or "None",
                weakest_mastery=f"{weakest_mastery}% mastery" if weakest_mastery is not None else "n/a",
                not_started_count=not_started_count,
            )

            response = self._chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You write short, warm, factual progress-plan intros."},
                    {"role": "user", "content": prompt},
                ],
                options={
                    "num_ctx": OLLAMA_NUM_CTX,
                    "num_predict": OLLAMA_STUDY_PLAN_NUM_PREDICT,
                    "temperature": OLLAMA_STUDY_PLAN_TEMPERATURE,
                },
            )

            content = str(response["message"]["content"] or "").strip()
            content = _strip_markdown_preamble(content)

            intro_span.update(output={"status": "completed", "response_chars": len(content)})

            return content

    # =====================================
    # TEST REVIEW
    # =====================================

    def generate_test_review(
        self,
        latest_score,
        average_score,
        tests_taken,
        previous_score=None,
        weakest_concept=None,
    ):
        """Short, real-numbers-only review of mock test performance — same
        posture and reuse of study-plan config as generate_study_plan_intro.
        Raises on failure; the Node side treats this as best-effort."""
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="test-review",
            model=self.model,
            input={
                "latest_score": latest_score,
                "previous_score": previous_score,
                "average_score": average_score,
                "tests_taken": tests_taken,
                "weakest_concept": weakest_concept,
            },
            model_parameters={
                "num_ctx": OLLAMA_NUM_CTX,
                "num_predict": OLLAMA_STUDY_PLAN_NUM_PREDICT,
                "temperature": OLLAMA_STUDY_PLAN_TEMPERATURE,
            },
        ) as review_span:
            prompt = TEST_REVIEW_PROMPT.format(
                latest_score=latest_score,
                previous_score=previous_score if previous_score is not None else "None",
                average_score=average_score,
                tests_taken=tests_taken,
                weakest_concept=weakest_concept or "None",
            )

            response = self._chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You write short, honest, factual test-performance reviews."},
                    {"role": "user", "content": prompt},
                ],
                options={
                    "num_ctx": OLLAMA_NUM_CTX,
                    "num_predict": OLLAMA_STUDY_PLAN_NUM_PREDICT,
                    "temperature": OLLAMA_STUDY_PLAN_TEMPERATURE,
                },
            )

            content = str(response["message"]["content"] or "").strip()
            content = _strip_markdown_preamble(content)

            review_span.update(output={"status": "completed", "response_chars": len(content)})

            return content

    # =====================================
    # BUILD NORMAL PROMPT
    # =====================================

    def _build_prompt(
            self,
            intent,
            question,
            context,
            subject,
            chapter,
            mode,
            figures=None,
            conversation="",
            memory="",
            board="CBSE",
            standard="Standard 9",
            response_mode="text",
    ):

        started_at = time.perf_counter()

        with langfuse.start_as_current_observation(
                as_type="span",
                name="prompt-building",
                input={
                    "intent": str(intent),
                    "subject": subject,
                    "chapter": chapter,
                    "mode": mode,
                    "board": board,
                    "standard": standard,
                    "question_chars": len(
                        str(question or "")
                    ),
                    "context_chars": len(
                        str(context or "")
                    ),
                    "conversation_chars": len(
                        str(conversation or "")
                    ),
                    "memory_chars": len(
                        str(memory or "")
                    ),
                },
        ) as prompt_span:

            try:

                template = self._select_prompt(
                    intent
                )

                # chapter is None when the student doesn't know which
                # chapter their question belongs to (main.py's
                # "search every chapter of this subject" mode) — context
                # then spans multiple chapters, each excerpt labelled
                # "[Chapter: <name>]" (see main.py's labeled_contexts).
                # Substitute a placeholder so the template never literally
                # formats in "None", and add an explicit instruction to
                # identify + state the chapter before answering. Normal
                # chapter-scoped chat (chapter is set) is unaffected.
                chapter_unknown = chapter is None
                chapter_for_prompt = chapter or "Unknown — identify it from the labelled excerpts in the context below"

                header = (
                    f"Board: {board}\n"
                    f"Standard: {standard}\n"
                    f"Subject: {subject}\n"
                    f"Chapter: {chapter_for_prompt}\n\n"
                )
                if chapter_unknown:
                    header += (
                        "IMPORTANT: The student does not know which chapter this question "
                        "belongs to. The context below is drawn from multiple chapters of "
                        "this subject, each excerpt labelled '[Chapter: <name>]' immediately "
                        "before it. Before answering, identify which chapter the relevant "
                        "content actually comes from using those exact labels, and open your "
                        "answer by clearly stating that chapter's name — then answer the "
                        "question using that chapter's content.\n\n"
                    )

                formatted_prompt = (
                    template.format(
                        subject=subject,
                        chapter=chapter_for_prompt,
                        mode=mode,
                        question=question,
                        context=context,
                        figures=figures,
                        conversation=conversation,
                        memory=memory,
                    )
                )

                final_prompt = (
                        header
                        + formatted_prompt
                )

                # The ONLY thing response_mode changes — same template,
                # same context, same intent, just an extra instruction
                # block telling the model to phrase this particular
                # answer for speech instead of for reading (see
                # VOICE_RESPONSE_INSTRUCTIONS's own comment in
                # core/prompts.py).
                if response_mode == "voice":
                    final_prompt = (
                        final_prompt
                        + "\n\n"
                        + VOICE_RESPONSE_INSTRUCTIONS
                    )

                elapsed = (
                        time.perf_counter()
                        - started_at
                )

                prompt_span.update(
                    output={
                        "prompt_chars": len(
                            final_prompt
                        ),
                        "duration_seconds":
                            elapsed,
                    }
                )

                return final_prompt

            except Exception as exc:

                prompt_span.update(
                    output={
                        "status": "failed",
                        "error_type":
                            type(exc).__name__,
                        "error": str(exc),
                        "duration_seconds": (
                                time.perf_counter()
                                - started_at
                        ),
                    }
                )

                raise

    # =====================================
    # SAFE MEMORY FORMATTER
    # =====================================

    def _build_safe_memory_text(
        self,
        memory,
    ) -> str:

        if not memory:
            return ""

        lines = []

        # ---------------------------------
        # RELEVANT SEMANTIC MEMORIES
        # ---------------------------------

        if isinstance(memory, dict):

            semantic_memories = memory.get(
                "relevant_semantic_memories",
                [],
            )

            if isinstance(
                semantic_memories,
                list,
            ):

                for item in (
                    semantic_memories[:3]
                ):

                    if not isinstance(
                        item,
                        dict,
                    ):
                        continue

                    text = str(
                        item.get("text", "")
                    ).strip()

                    memory_type = str(
                        item.get(
                            "memory_type",
                            "",
                        )
                    ).strip()

                    if not text:
                        continue

                    if memory_type:
                        lines.append(
                            f"- {memory_type}: "
                            f"{text}"
                        )
                    else:
                        lines.append(
                            f"- {text}"
                        )

            # ---------------------------------
            # STRUCTURED MEMORY
            # ---------------------------------

            structured = memory.get(
                "structured"
            )

            if isinstance(
                structured,
                dict,
            ):

                quiz_results = (
                    structured.get(
                        "quiz_results"
                    )
                )

                total_score = (
                    structured.get(
                        "total_score"
                    )
                )

                if quiz_results:
                    lines.append(
                        "- Previous quiz activity "
                        "is available."
                    )

                if total_score is not None:
                    lines.append(
                        "- Previous total score: "
                        f"{total_score}"
                    )

        # ---------------------------------
        # FALLBACK
        # ---------------------------------

        if not lines:
            return ""

        return "\n".join(
            lines[:5]
        )


    # =====================================
    # MODEL OUTPUT SANITIZER
    # =====================================

    def _sanitize_model_output(
        self,
        content: str,
    ) -> str:

        if not content:
            return (
                "I could not generate a clear "
                "answer. Please try again."
            )

        # Retrieved textbook chunks sometimes include the worksheet/exercise
        # scaffolding around a figure (e.g. "(Referring to Fig. 1.3, answer
        # the following questions:)") rather than the figure explanation
        # itself. The model can echo that instruction text verbatim into an
        # answer/summary, which reads as a leftover prompt fragment to the
        # student. Strip only that narrow, worksheet-instruction shape -
        # a real inline figure citation (e.g. "With reference to Figure
        # 6.2...") is never wrapped in parentheses paired with "answer the
        # following", so this never touches legitimate content.
        import re as _re

        content = _re.sub(
            r"\(\s*(?:referring|refer|with reference)\s+to\s+[^)]*?"
            r"answer\s+the\s+following[^)]*?\)",
            "",
            content,
            flags=_re.IGNORECASE | _re.DOTALL,
        ).strip()

        private_markers = (
            "<task_context>",
            "<student_question>",
            "<conversation_history>",
            "<student_memory>",
            "<textbook_evidence>",
            "<textbook_figures>",
        )

        # ---------------------------------
        # FAST PATH
        # ---------------------------------

        if not any(
            marker in content
            for marker in private_markers
        ):
            return content.strip()

        print(
            "[WARN] Private prompt marker "
            "detected in model output."
        )

        # ---------------------------------
        # REMOVE PRIVATE XML-LIKE BLOCKS
        # ---------------------------------

        import re

        cleaned = content

        block_names = (
            "task_context",
            "student_question",
            "conversation_history",
            "student_memory",
            "textbook_evidence",
            "textbook_figures",
        )

        for block_name in block_names:

            cleaned = re.sub(
                rf"<{block_name}>.*?"
                rf"</{block_name}>",
                "",
                cleaned,
                flags=re.DOTALL
                | re.IGNORECASE,
            )

        cleaned = cleaned.strip()

        # ---------------------------------
        # FAIL CLOSED
        # ---------------------------------

        if not cleaned:

            return (
                "I could not generate a clean "
                "student-facing answer. "
                "Please try the question again."
            )

        return cleaned

    # =====================================
    # NORMAL RESPONSE GENERATION
    # =====================================

    def generate(
            self,
            intent,
            question,
            context,
            subject,
            chapter,
            mode,
            figures=None,
            conversation=None,
            memory=None,
            board: str = "CBSE",
            standard: str = "Standard 9",
            response_mode: str = "text",
            image_description: str | None = None,
    ) -> str:

        total_start = time.perf_counter()

        current_question = str(
            question or ""
        ).strip()

        if not current_question:
            raise ValueError(
                "TutorEngine.generate() received "
                "an empty question."
            )

        with langfuse.start_as_current_observation(
                as_type="span",
                name="normal-response-generation",
                input={
                    "intent": str(intent),
                    "question": current_question,
                    "subject": subject,
                    "chapter": chapter,
                    "mode": mode,
                    "board": board,
                    "standard": standard,
                    "raw_context_chars": len(
                        str(context or "")
                    ),
                    "conversation_messages": len(
                        conversation or []
                    ),
                    "has_memory": bool(memory),
                },
        ) as generation_span:

            try:

                try:
                    print("=" * 60)
                    print("TUTOR ENGINE INPUT")
                    print(
                        "QUESTION :",
                        repr(current_question),
                    )
                    print("INTENT   :", intent)
                    print("SUBJECT  :", subject)
                    print("CHAPTER  :", chapter)
                    print("MODE     :", mode)
                    print("=" * 60)
                except UnicodeEncodeError:
                    pass

                # =============================
                # CONVERSATION PREPARATION
                # =============================

                conversation_start = (
                    time.perf_counter()
                )

                with (
                        langfuse
                                .start_as_current_observation(
                            as_type="span",
                            name=(
                                    "conversation-preparation"
                            ),
                            input={
                                "available_messages": len(
                                    conversation or []
                                ),
                            },
                        )
                ) as conversation_span:

                    conversation_lines = []

                    if conversation:

                        for msg in conversation[-4:]:

                            if not isinstance(
                                    msg,
                                    dict,
                            ):
                                continue

                            role = str(
                                msg.get(
                                    "role",
                                    "",
                                )
                            ).strip().lower()

                            content = str(
                                msg.get(
                                    "content",
                                    "",
                                )
                            ).strip()

                            if not content:
                                continue

                            if role not in {
                                "user",
                                "assistant",
                            }:
                                continue

                            if (
                                    role == "user"
                                    and content
                                    == current_question
                            ):
                                continue

                            leak_markers = (
                                "<task_context>",
                                "<student_question>",
                                "<conversation_history>",
                                "<student_memory>",
                                "<textbook_evidence>",
                                "<textbook_figures>",
                            )

                            if any(
                                    marker in content
                                    for marker
                                    in leak_markers
                            ):
                                continue

                            label = (
                                "Student"
                                if role == "user"
                                else "Tutor"
                            )

                            conversation_lines.append(
                                f"{label}: {content}"
                            )

                    conversation_text = "\n".join(
                        conversation_lines
                    )

                    conversation_span.update(
                        output={
                            "selected_messages": len(
                                conversation_lines
                            ),
                            "conversation_chars": len(
                                conversation_text
                            ),
                            "duration_seconds": (
                                    time.perf_counter()
                                    - conversation_start
                            ),
                        }
                    )

                # =============================
                # MEMORY PREPARATION
                # =============================

                memory_start = (
                    time.perf_counter()
                )

                with (
                        langfuse
                                .start_as_current_observation(
                            as_type="span",
                            name="memory-preparation",
                            input={
                                "has_memory": bool(
                                    memory
                                ),
                            },
                        )
                ) as memory_span:

                    memory_text = ""
                    figure_context = self._build_figure_context(
                        figures,
                    )

                    if memory:

                        try:
                            memory_text = (
                                self
                                ._build_safe_memory_text(
                                    memory
                                )
                            )

                        except Exception as exc:

                            print(
                                "[WARN] Memory "
                                "formatting failed:",
                                repr(exc),
                            )

                            memory_text = ""

                            memory_span.update(
                                output={
                                    "formatting_failed":
                                        True,
                                    "error_type":
                                        type(exc)
                                        .__name__,
                                }
                            )

                    memory_span.update(
                        output={
                            "memory_chars": len(
                                memory_text
                            ),
                            "duration_seconds": (
                                    time.perf_counter()
                                    - memory_start
                            ),
                        }
                    )

                # =============================
                # CONTEXT LIMIT
                # =============================

                safe_context = str(
                    context or ""
                )[:RAG_CONTEXT_MAX_CHARS]

                # =============================
                # BUILD FINAL PROMPT
                # =============================

                prompt_start = (
                    time.perf_counter()
                )

                prompt = self._build_prompt(
                    intent=intent,
                    question=current_question,
                    figures=figure_context,
                    context=safe_context,
                    subject=subject,
                    chapter=chapter,
                    mode=mode,
                    conversation=(
                        conversation_text
                    ),
                    memory=memory_text,
                    board=board,
                    standard=standard,
                    response_mode=response_mode,
                )

                # Image support (Phase 1 — local Qwen pre-processing only,
                # see core/image_chat.py): the vision model's text
                # description of the student's attached image is appended
                # here as plain text, same as the voice-instructions block
                # below — no changes to _build_prompt's templates or to
                # llm_provider.generate()'s message shape are needed.
                if image_description:
                    prompt = (
                        prompt
                        + "\n\nAttached Image Content:\n"
                        + image_description
                        + "\n\nCRITICAL MANDATORY SOLVING RULES FOR ATTACHED IMAGES / QUESTION PAPERS:\n"
                        + "1. NEVER output a bare answer key or short list of option letters alone (such as '1. b) √5' or '2. b) II'). This is STRICTLY FORBIDDEN.\n"
                        + "2. For EVERY question present in the image, you MUST provide a full, detailed step-by-step mathematical/logical explanation.\n"
                        + "3. For each question, strictly follow this structure:\n"
                        + "   - **Question N**\n"
                        + "   - **Concept / Formula:** Explain the theory or identity used.\n"
                        + "   - **Step-by-Step Derivation:** Show every algebraic step or reasoning clearly.\n"
                        + "   - **Final Answer:** State the correct option and answer (e.g. **Answer: b) √5**).\n"
                        + "4. Solve all transcribed questions systematically and clearly."
                    )

                prompt_time = (
                        time.perf_counter()
                        - prompt_start
                )

                print(
                    f"[PERF] Prompt building: "
                    f"{prompt_time:.3f}s"
                )

                print(
                    f"[PERF] Prompt chars: "
                    f"{len(prompt):,}"
                )

                if current_question not in prompt:
                    raise RuntimeError(
                        "Current question missing "
                        "from final tutor prompt."
                    )

                # Guarded the same way as rag/vector_db.py's search()
                # debug prints: repr(current_question) for a Hindi/
                # Gujarati question raises UnicodeEncodeError on Windows'
                # cp1252 console, and an uncaught exception here would
                # abort generation entirely over pure debug output.
                try:
                    print("=" * 60)
                    print(
                        "STARTING NORMAL OLLAMA "
                        "GENERATION"
                    )
                    print("MODEL  :", self.model)
                    print("INTENT :", intent)
                    print(
                        "CURRENT QUESTION :",
                        repr(current_question),
                    )
                    print(
                        "PROMPT LENGTH :",
                        len(prompt),
                    )
                    print("=" * 60)
                except UnicodeEncodeError:
                    pass

                # Hindi/Gujarati are language subjects (taught in that
                # language, like English's prose/poetry chapters) - not a
                # generic "translate any subject" toggle. Any other
                # subject keeps today's behavior exactly (language_model
                # stays None -> _chat's cloud-first path, unchanged).
                subject_lower = (subject or "").strip().lower()
                if subject_lower == "hindi":
                    base_prompt = SYSTEM_PROMPT_HINDI
                    language_model = OLLAMA_CHAT_MODEL_HI
                elif subject_lower == "gujarati":
                    base_prompt = SYSTEM_PROMPT_GUJARATI
                    language_model = OLLAMA_CHAT_MODEL_GU
                else:
                    base_prompt = SYSTEM_PROMPT
                    language_model = None

                custom_sys = (
                    base_prompt.replace(
                        "CBSE Class 9",
                        f"{board} {standard}",
                    )
                )

                # =============================
                # OLLAMA GENERATION
                # =============================

                ollama_start = (
                    time.perf_counter()
                )

                with (
                        langfuse
                                .start_as_current_observation(
                            as_type="generation",
                            name="ollama-generation",
                            model=language_model or self.model,
                            input={
                                "messages": [
                                    {
                                        "role": "system",
                                        "content_chars": len(
                                            custom_sys
                                        ),
                                    },
                                    {
                                        "role": "user",
                                        "content_chars": len(
                                            prompt
                                        ),
                                    },
                                ],
                                "question":
                                    current_question,
                            },
                            model_parameters={
                                "num_predict":
                                    OLLAMA_CHAT_NUM_PREDICT,
                                "temperature":
                                    OLLAMA_TEMPERATURE,
                                "num_ctx":
                                    OLLAMA_CHAT_NUM_CTX,
                            },
                            metadata={
                                "provider": "ollama",
                                "host": self.host,
                                "intent": str(intent),
                                "subject": subject,
                                "chapter": chapter,
                                "mode": mode,
                                "board": board,
                                "standard": standard,
                            },
                        )
                ) as ollama_generation:

                    try:

                        response = (
                            self._chat(
                                model=language_model or self.model,
                                messages=[
                                    {
                                        "role":
                                            "system",
                                        "content":
                                            custom_sys,
                                    },
                                    {
                                        "role":
                                            "user",
                                        "content":
                                            prompt,
                                    },
                                ],
                                options={
                                    "num_predict":
                                        OLLAMA_CHAT_NUM_PREDICT,
                                    "temperature":
                                        OLLAMA_TEMPERATURE,
                                    "num_ctx":
                                        OLLAMA_CHAT_NUM_CTX,
                                },
                                force_local=bool(language_model),
                            )
                        )

                        ollama_time = (
                                time.perf_counter()
                                - ollama_start
                        )

                        raw_content = str(
                            response[
                                "message"
                            ]["content"]
                            or ""
                        ).strip()

                        ollama_generation.update(
                            output={
                                "response_chars": len(
                                    raw_content
                                ),
                                "duration_seconds":
                                    ollama_time,
                            }
                        )

                    except Exception as exc:

                        ollama_generation.update(
                            output={
                                "status": "failed",
                                "error_type":
                                    type(exc)
                                    .__name__,
                                "error": str(exc),
                                "duration_seconds": (
                                        time.perf_counter()
                                        - ollama_start
                                ),
                            }
                        )

                        raise

                ollama_time = (
                        time.perf_counter()
                        - ollama_start
                )

                print(
                    f"[PERF] Ollama generation: "
                    f"{ollama_time:.3f}s"
                )

                print(
                    f"[PERF] Raw output chars: "
                    f"{len(raw_content):,}"
                )

                # =============================
                # OUTPUT SANITIZATION
                # =============================

                sanitize_start = (
                    time.perf_counter()
                )

                with (
                        langfuse
                                .start_as_current_observation(
                            as_type="span",
                            name="output-sanitization",
                            input={
                                "raw_output_chars": len(
                                    raw_content
                                ),
                            },
                        )
                ) as sanitize_span:

                    content = (
                        self._sanitize_model_output(
                            raw_content
                        )
                    )

                    sanitize_span.update(
                        output={
                            "final_output_chars": len(
                                content
                            ),
                            "changed": (
                                    content
                                    != raw_content
                            ),
                            "duration_seconds": (
                                    time.perf_counter()
                                    - sanitize_start
                            ),
                        }
                    )

                print(
                    f"[PERF] Final output chars: "
                    f"{len(content):,}"
                )

                total_elapsed = (
                        time.perf_counter()
                        - total_start
                )

                print(
                    f"[PERF] Total tutor generate: "
                    f"{total_elapsed:.3f}s"
                )

                generation_span.update(
                    output={
                        "status": "completed",
                        "prompt_chars": len(
                            prompt
                        ),
                        "safe_context_chars": len(
                            safe_context
                        ),
                        "conversation_chars": len(
                            conversation_text
                        ),
                        "memory_chars": len(
                            memory_text
                        ),
                        "answer_chars": len(
                            content
                        ),
                        "duration_seconds":
                            total_elapsed,
                    }
                )

                return content

            except Exception as exc:

                generation_span.update(
                    output={
                        "status": "failed",
                        "error_type":
                            type(exc).__name__,
                        "error": str(exc),
                        "duration_seconds": (
                                time.perf_counter()
                                - total_start
                        ),
                    }
                )

                try:
                    print("=" * 60)
                    print(
                        "OLLAMA GENERATION FAILED"
                    )
                    print(
                        "ERROR:",
                        repr(exc),
                    )
                    print("=" * 60)
                except UnicodeEncodeError:
                    pass

                #
                # Reliability: everything upstream (retrieval,
                # memory, prompt assembly) already succeeded — only
                # the model call itself failed (timeout, connection
                # error, malformed response, etc). Degrade to a
                # calm, student-facing fallback instead of
                # propagating a raw exception, so a transient LLM
                # hiccup doesn't take down the whole chat turn.
                #
                return GENERATION_FALLBACK_MESSAGE


# =========================================
# AI LEARNING DECK VALIDATION (Phase 1)
# =========================================

def validate_slide_deck(deck: dict) -> list[str]:
    """Deterministic, log-only checks on a generated slide deck (see
    TutorEngine.generate_slide_deck) — module-level rather than a method
    since it needs no model/client state, so core/slide_deck_tasks.py can
    call it without instantiating a TutorEngine. Phase 1 does NOT
    auto-regenerate on any of these failing; this exists purely to give
    real visibility into what the local model actually produces in
    production before deciding whether stricter enforcement or auto-retry
    is worth building. Returns the list of problems found (empty if
    none) so callers can log/count them without re-deriving this logic."""
    problems = []
    slides = deck.get("slides") or []

    if not (12 <= len(slides) <= 18):
        problems.append(f"slide count {len(slides)} is outside the expected 12-18 range")

    if not slides or slides[0].get("type") != "hook":
        problems.append("first slide is not type 'hook'")

    if not slides or slides[-1].get("type") != "recap":
        problems.append("last slide is not type 'recap'")

    if not any(s.get("type") == "concept" for s in slides):
        problems.append("no 'concept' slide present")

    if not any(s.get("type") == "question" for s in slides):
        problems.append("no 'question' slide present")

    for slide in slides:
        if slide.get("type") != "recap" and slide.get("citation") is None:
            problems.append(f"slide {slide.get('id')} ({slide.get('type')}) has no resolved citation")
        if slide.get("type") == "question":
            options = slide.get("options") or {}
            correct = slide.get("correct_answer")
            if correct not in ("A", "B", "C", "D") or not options.get(correct):
                problems.append(f"slide {slide.get('id')} is type 'question' but has an invalid correct_answer")

    if problems:
        logger.warning("Slide deck validation found %d problem(s): %s", len(problems), problems)

    return problems


# =========================================
# INFOGRAPHIC VALIDATION
# =========================================

def validate_infographic(infographic: dict) -> list[str]:
    """Deterministic, log-only checks on a generated infographic (see
    TutorEngine.generate_infographic) — module-level for the same reason
    validate_slide_deck is: core/infographic_tasks.py calls it without
    instantiating a TutorEngine. Never blocks or regenerates; exists
    purely for production visibility."""
    problems = []

    if not (infographic.get("chapter_title") or "").strip():
        problems.append("chapter_title is empty")

    if not (infographic.get("big_picture") or "").strip():
        problems.append("big_picture is empty")

    key_concepts = infographic.get("key_concepts") or []
    if not (4 <= len(key_concepts) <= 8):
        problems.append(f"key_concepts count {len(key_concepts)} is outside the expected 4-8 range")

    quick_recap = infographic.get("quick_recap") or []
    if not quick_recap:
        problems.append("quick_recap is empty")

    for section in ("key_concepts", "formulas", "definitions", "common_mistakes"):
        for item in infographic.get(section) or []:
            if item.get("citation") is None:
                label = item.get("title") or item.get("name") or item.get("term") or item.get("mistake")
                problems.append(f"{section} item {label!r} has no resolved citation")

    if problems:
        logger.warning("Infographic validation found %d problem(s): %s", len(problems), problems)

    return problems