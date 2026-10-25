from enum import Enum
import re


class Intent(str, Enum):
    CHAT = "chat"
    EXPLAIN = "explain"
    DEFINITION = "definition"
    FOLLOW_UP = "follow_up"
    MCQ = "mcq"
    QUESTION_PAPER = "question_paper"
    ANSWER_SHEET = "answer_sheet"
    SUMMARY = "summary"
    REVISION = "revision"
    QUIZ = "quiz"
    HINT = "hint"


class IntentRouter:

    # =========================================
    # NORMALIZATION
    # =========================================

    @staticmethod
    def _normalize(text: str) -> str:
        return " ".join(
            (text or "")
            .lower()
            .strip()
            .split()
        )

    # =========================================
    # PHRASE MATCHING
    # =========================================

    @staticmethod
    def _contains_phrase(
        text: str,
        phrases: tuple[str, ...],
    ) -> bool:
        return any(
            phrase in text
            for phrase in phrases
        )

    # =========================================
    # INTENT DETECTION
    # =========================================

    def detect(
        self,
        question: str,
    ) -> Intent:

        text = self._normalize(question)

        if not text:
            return Intent.CHAT

        # -------------------------------------
        # HINT
        #
        # Checked first and narrowly: a student
        # asking for a hint on a specific question
        # must never get the full worked answer,
        # so this can't be left to fall through to
        # Intent.CHAT (QA_PROMPT, which answers
        # fully) the way an unmatched question did
        # before this intent existed.
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "give me a hint",
                "give a hint",
                "can i get a hint",
                "a hint for this",
                "a hint please",
                "hint please",
                "just a hint",
                "give me a clue",
                "give a clue",
                "without revealing the answer",
                "without giving the answer",
                "without giving away the answer",
                "without telling me the answer",
                "dont tell me the answer",
                "don't tell me the answer",
                "do not tell me the answer",
                "no spoilers",
            ),
        ) or re.search(r"\bhint\b", text) or re.search(r"\bclue\b", text):
            return Intent.HINT

        # -------------------------------------
        # QUESTION PAPER
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "question paper",
                "sample paper",
                "practice paper",
                "exam paper",
                "mock paper",
                "mock test",
                "create a test",
                "generate a test",
            ),
        ):
            return Intent.QUESTION_PAPER

        # -------------------------------------
        # ANSWER SHEET
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "answer sheet",
                "answer key",
                "solutions sheet",
                "solution sheet",
            ),
        ):
            return Intent.ANSWER_SHEET

        # -------------------------------------
        # MCQ
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "mcq",
                "multiple choice",
                "multiple-choice",
                "objective questions",
                "objective question",
            ),
        ):
            return Intent.MCQ

        # -------------------------------------
        # QUIZ
        # -------------------------------------

        # -------------------------------------
        # QUIZ
        # -------------------------------------

        if self._contains_phrase(
                text,
                (
                        "quiz me",
                        "quiz",
                        "start quiz",
                        "start a quiz",
                        "take quiz",
                        "take a quiz",
                        "give me quiz",
                        "give me a quiz",
                        "generate quiz",
                        "generate a quiz",
                        "create quiz",
                        "create a quiz",
                        "test me",
                ),
        ):
            return Intent.QUIZ

        # -------------------------------------
        # REVISION
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "revise",
                "revision",
                "review this chapter",
                "review the chapter",
                "help me review",
                "recap",
                "quick recap",
            ),
        ):
            return Intent.REVISION

        # -------------------------------------
        # SUMMARY
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "summarize",
                "summarise",
                "summary",
                "short notes",
                "brief notes",
                "key points",
                "main points",
            ),
        ):
            return Intent.SUMMARY

        # -------------------------------------
        # FOLLOW-UP
        #
        # These requests depend on previous
        # conversation or previous explanation.
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "explain it again",
                "explain that again",
                "say it again",
                "tell me again",
                "simplify it",
                "simplify that",
                "make it simpler",
                "make that simpler",
                "in simpler words",
                "in simple words",
                "another example",
                "one more example",
                "give another example",
                "give me another example",
                "continue",
                "continue from there",
                "what about that",
                "what about this",
                "why is that",
                "why is this",
                "how is that",
                "how is this",
                "i didn't understand",
                "i did not understand",
                "didn't understand",
                "dont understand",
                "don't understand",
            ),
        ):
            return Intent.FOLLOW_UP

        # Short pronoun-dependent requests
        if re.search(
            r"\b("
            r"it|that|this|those|these"
            r")\b",
            text,
        ):
            if self._contains_phrase(
                text,
                (
                    "explain",
                    "simplify",
                    "repeat",
                    "clarify",
                    "continue",
                ),
            ):
                return Intent.FOLLOW_UP

        # -------------------------------------
        # DEFINITION
        # -------------------------------------

        definition_patterns = (
            r"^define\b",
            r"^what is\b",
            r"^what are\b",
            r"^what does\b.+\bmean\b",
            r"^meaning of\b",
            r"^give (me )?the definition of\b",
            r"^definition of\b",
        )

        if any(
            re.search(pattern, text)
            for pattern in definition_patterns
        ):
            return Intent.DEFINITION

        # -------------------------------------
        # EXPLANATION
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "explain",
                "teach me",
                "help me understand",
                "describe",
                "how does",
                "how do",
                "why does",
                "why do",
                "why is",
                "why are",
                "show me how",
            ),
        ):
            return Intent.EXPLAIN

        # -------------------------------------
        # DEFAULT
        # -------------------------------------

        return Intent.CHAT

    # =========================================
    # MEMORY ACCESS DECISION
    # =========================================

    def should_use_memory(
        self,
        question: str,
        intent: Intent | None = None,
        mode: str | None = None,
    ) -> bool:

        text = self._normalize(question)

        if not text:
            return False

        resolved_intent = (
            intent
            if intent is not None
            else self.detect(question)
        )

        normalized_mode = self._normalize(
            mode or ""
        )

        # -------------------------------------
        # ALWAYS USE MEMORY
        # -------------------------------------

        if resolved_intent in (
            Intent.FOLLOW_UP,
            Intent.REVISION,
        ):
            return True

        # -------------------------------------
        # MEMORY-HEAVY STUDY MODES
        # -------------------------------------

        if normalized_mode in (
            "revision",
            "practice",
        ):
            return True

        # -------------------------------------
        # PERSONALIZED / ADAPTIVE REQUESTS
        # -------------------------------------

        if self._contains_phrase(
            text,
            (
                "based on my progress",
                "based on my performance",
                "based on my mistakes",
                "based on my previous",
                "based on what i learned",
                "what i learned before",
                "what did i learn",
                "my weak topic",
                "my weak topics",
                "my weak concept",
                "my weak concepts",
                "my mistakes",
                "my previous mistakes",
                "where am i weak",
                "what am i weak at",
                "what should i revise",
                "what should i practice",
                "personalize",
                "personalized",
                "adaptive practice",
                "according to my progress",
            ),
        ):
            return True

        # -------------------------------------
        # SIMPLE REQUESTS SKIP MEMORY
        # -------------------------------------

        if resolved_intent in (
            Intent.DEFINITION,
            Intent.EXPLAIN,
            Intent.CHAT,
            Intent.SUMMARY,
            Intent.MCQ,
            Intent.QUESTION_PAPER,
            Intent.ANSWER_SHEET,
            Intent.QUIZ,
            Intent.HINT,
        ):
            return False

        return False