"""
Assessment Engine

Defines the shape of a generated quiz question. Scoring, progress, and
attempt state live in the Node backend's quiz_attempts/quiz_answers
tables — this service is stateless and never grades or persists a
session; it only generates questions (see TutorEngine.generate_quiz).
"""

from dataclasses import dataclass
from typing import Dict


# ==========================================================
# Quiz Question
# ==========================================================

@dataclass
class QuizQuestion:
    question: str
    options: Dict[str, str]
    correct_answer: str
    explanation: str
    # Short sub-topic label the question tests (e.g. "Newton's Third
    # Law") — see QUIZ_PROMPT in prompts.py and generate_quiz's structured-
    # output schema in tutor_engine.py. Optional so older callers/tests
    # constructing a QuizQuestion directly don't need updating.
    concept: str = ""