from dataclasses import dataclass
from enum import Enum

from core.intent_router import Intent


# ============================================================
# RESPONSE TIERS
# ============================================================

class ResponseTier(str, Enum):
    """
    Pedagogical response strategies.

    These tiers describe HOW the tutor should teach.

    They do NOT describe:
    - query modality
    - visual requirements
    - evidence type
    - retrieval strategy
    - subject-specific structure
    """

    FOUNDATION = "foundation"
    EXPLANATION = "explanation"
    WORKED_EXAMPLE = "worked_example"
    PROBLEM_SOLVING = "problem_solving"
    STUDY_GUIDE = "study_guide"
    REVISION = "revision"
    ASSESSMENT = "assessment"
    ADAPTIVE_FOLLOW_UP = "adaptive_follow_up"
    GENERAL_TUTOR = "general_tutor"


# ============================================================
# RESPONSE TIER CONFIGURATION
# ============================================================

@dataclass(frozen=True)
class ResponseTierConfig:
    """
    Stable pedagogical configuration for one response tier.

    Important:
    This configuration controls answer behavior and prompt
    assembly guidance only.

    It must not directly control:
    - vector retrieval top_k
    - visual retrieval
    - visual grouping
    - cross-modal reranking
    - media selection
    """

    tier: ResponseTier

    # Human-readable purpose for tracing/debugging.
    purpose: str

    # Pedagogical behavior flags.
    direct_answer_first: bool = True
    include_simple_explanation: bool = True
    include_example_when_useful: bool = True
    include_step_by_step: bool = False
    include_common_mistakes: bool = False
    include_key_takeaway: bool = True
    include_practice_question: bool = False

    # Whether previous conversation is especially important
    # for producing a coherent answer.
    conversation_sensitive: bool = False

    # Whether student memory can meaningfully personalize
    # this response tier.
    memory_sensitive: bool = False

    # Prompt-assembly guidance only.
    #
    # This is NOT retrieval top_k.
    # Retrieval and multimodal evidence selection remain
    # independent from pedagogical response tiers.
    evidence_detail: str = "balanced"

    # Generation guidance.
    #
    # These are semantic labels for now.
    # We are intentionally NOT changing Ollama token limits
    # in this step.
    answer_depth: str = "balanced"


# ============================================================
# TIER CONFIGURATIONS
# ============================================================

TIER_CONFIGS: dict[
    ResponseTier,
    ResponseTierConfig,
] = {

    # --------------------------------------------------------
    # FOUNDATION
    #
    # Used for definitions and first-contact concepts.
    # Goal:
    # clear enough for understanding, not one-line answers.
    # --------------------------------------------------------

    ResponseTier.FOUNDATION:
        ResponseTierConfig(
            tier=ResponseTier.FOUNDATION,
            purpose=(
                "Teach a concept clearly to a student who may "
                "be encountering it for the first time."
            ),
            direct_answer_first=True,
            include_simple_explanation=True,
            include_example_when_useful=True,
            include_step_by_step=False,
            include_common_mistakes=False,
            include_key_takeaway=True,
            include_practice_question=False,
            conversation_sensitive=False,
            memory_sensitive=False,
            evidence_detail="focused",
            answer_depth="focused_teaching",
        ),

    # --------------------------------------------------------
    # EXPLANATION
    #
    # Used for conceptual teaching and deeper understanding.
    # --------------------------------------------------------

    ResponseTier.EXPLANATION:
        ResponseTierConfig(
            tier=ResponseTier.EXPLANATION,
            purpose=(
                "Teach the concept with intuition, clear "
                "breakdown, relevant examples, and enough "
                "detail for genuine understanding."
            ),
            direct_answer_first=True,
            include_simple_explanation=True,
            include_example_when_useful=True,
            include_step_by_step=True,
            include_common_mistakes=True,
            include_key_takeaway=True,
            include_practice_question=True,
            conversation_sensitive=False,
            memory_sensitive=False,
            evidence_detail="detailed",
            answer_depth="detailed_teaching",
        ),

    # --------------------------------------------------------
    # WORKED EXAMPLE
    #
    # Used when the student explicitly asks for an example.
    # --------------------------------------------------------

    ResponseTier.WORKED_EXAMPLE:
        ResponseTierConfig(
            tier=ResponseTier.WORKED_EXAMPLE,
            purpose=(
                "Teach through a concrete example and walk "
                "the student through how the example works."
            ),
            direct_answer_first=True,
            include_simple_explanation=True,
            include_example_when_useful=True,
            include_step_by_step=True,
            include_common_mistakes=True,
            include_key_takeaway=True,
            include_practice_question=True,
            conversation_sensitive=False,
            memory_sensitive=False,
            evidence_detail="example_focused",
            answer_depth="worked_teaching",
        ),

    # --------------------------------------------------------
    # PROBLEM SOLVING
    #
    # Used for numerical and explicit solve requests.
    #
    # Important:
    # This does NOT classify the query as numerical.
    # That belongs to multimodal/query understanding.
    # --------------------------------------------------------

    ResponseTier.PROBLEM_SOLVING:
        ResponseTierConfig(
            tier=ResponseTier.PROBLEM_SOLVING,
            purpose=(
                "Guide the student through a problem using a "
                "clear method, justified steps, final answer, "
                "and verification when appropriate."
            ),
            direct_answer_first=False,
            include_simple_explanation=True,
            include_example_when_useful=False,
            include_step_by_step=True,
            include_common_mistakes=True,
            include_key_takeaway=True,
            include_practice_question=True,
            conversation_sensitive=False,
            memory_sensitive=False,
            evidence_detail="solution_focused",
            answer_depth="step_by_step",
        ),

    # --------------------------------------------------------
    # STUDY GUIDE
    #
    # Used for important topics, chapter priorities,
    # recommended study order, exam preparation.
    # --------------------------------------------------------

    ResponseTier.STUDY_GUIDE:
        ResponseTierConfig(
            tier=ResponseTier.STUDY_GUIDE,
            purpose=(
                "Help the student understand what to study, "
                "why each topic matters, what to prioritize, "
                "and how to organize learning."
            ),
            direct_answer_first=True,
            include_simple_explanation=True,
            include_example_when_useful=False,
            include_step_by_step=False,
            include_common_mistakes=True,
            include_key_takeaway=True,
            include_practice_question=False,
            conversation_sensitive=False,
            memory_sensitive=False,
            evidence_detail="broad_structured",
            answer_depth="structured_study_guidance",
        ),

    # --------------------------------------------------------
    # REVISION
    #
    # Used for recap and revision-oriented requests.
    # --------------------------------------------------------

    ResponseTier.REVISION:
        ResponseTierConfig(
            tier=ResponseTier.REVISION,
            purpose=(
                "Support efficient revision using key ideas, "
                "important facts, formulas when relevant, "
                "common mistakes, and recall-oriented structure."
            ),
            direct_answer_first=True,
            include_simple_explanation=True,
            include_example_when_useful=True,
            include_step_by_step=False,
            include_common_mistakes=True,
            include_key_takeaway=True,
            include_practice_question=True,
            conversation_sensitive=True,
            memory_sensitive=True,
            evidence_detail="broad_revision",
            answer_depth="revision_focused",
        ),

    # --------------------------------------------------------
    # ASSESSMENT
    #
    # Used for MCQs, quizzes, question papers,
    # and answer sheets.
    # --------------------------------------------------------

    ResponseTier.ASSESSMENT:
        ResponseTierConfig(
            tier=ResponseTier.ASSESSMENT,
            purpose=(
                "Generate or support structured assessment "
                "content appropriate to the student's class, "
                "subject, chapter, and requested format."
            ),
            direct_answer_first=False,
            include_simple_explanation=False,
            include_example_when_useful=False,
            include_step_by_step=False,
            include_common_mistakes=False,
            include_key_takeaway=False,
            include_practice_question=False,
            conversation_sensitive=False,
            memory_sensitive=False,
            evidence_detail="assessment_grounded",
            answer_depth="task_dependent",
        ),

    # --------------------------------------------------------
    # ADAPTIVE FOLLOW-UP
    #
    # Used when the student refers to previous explanation,
    # asks for simplification, continuation, or another example.
    # --------------------------------------------------------

    ResponseTier.ADAPTIVE_FOLLOW_UP:
        ResponseTierConfig(
            tier=ResponseTier.ADAPTIVE_FOLLOW_UP,
            purpose=(
                "Continue from prior conversation and adapt "
                "the explanation to the student's apparent "
                "need without unnecessarily restarting."
            ),
            direct_answer_first=True,
            include_simple_explanation=True,
            include_example_when_useful=True,
            include_step_by_step=True,
            include_common_mistakes=True,
            include_key_takeaway=True,
            include_practice_question=False,
            conversation_sensitive=True,
            memory_sensitive=True,
            evidence_detail="targeted",
            answer_depth="adaptive",
        ),

    # --------------------------------------------------------
    # GENERAL TUTOR
    #
    # Safe fallback for educational chat that does not map
    # cleanly to another pedagogical tier.
    # --------------------------------------------------------

    ResponseTier.GENERAL_TUTOR:
        ResponseTierConfig(
            tier=ResponseTier.GENERAL_TUTOR,
            purpose=(
                "Respond naturally as a helpful tutor while "
                "remaining grounded in available educational "
                "evidence."
            ),
            direct_answer_first=True,
            include_simple_explanation=True,
            include_example_when_useful=True,
            include_step_by_step=False,
            include_common_mistakes=False,
            include_key_takeaway=True,
            include_practice_question=False,
            conversation_sensitive=False,
            memory_sensitive=False,
            evidence_detail="balanced",
            answer_depth="balanced",
        ),
}


# ============================================================
# RESPONSE TIER SELECTOR
# ============================================================

class ResponseTierSelector:
    """
    Maps pedagogical Intent -> ResponseTier.

    This selector answers:
        "How should the tutor teach?"

    It does NOT answer:
        "Does the query need a graph?"
        "Should a diagram be retrieved?"
        "Is this a process or structure query?"
        "Which visual group should be selected?"

    Those decisions remain in the multimodal
    query-understanding and media pipeline.
    """

    _INTENT_TO_TIER: dict[
        Intent,
        ResponseTier,
    ] = {

        Intent.DEFINITION:
            ResponseTier.FOUNDATION,

        Intent.EXPLAIN:
            ResponseTier.EXPLANATION,

        Intent.EXAMPLE:
            ResponseTier.WORKED_EXAMPLE,

        Intent.PROBLEM_SOLVING:
            ResponseTier.PROBLEM_SOLVING,

        Intent.STUDY_GUIDE:
            ResponseTier.STUDY_GUIDE,

        Intent.SUMMARY:
            ResponseTier.STUDY_GUIDE,

        Intent.REVISION:
            ResponseTier.REVISION,

        Intent.FOLLOW_UP:
            ResponseTier.ADAPTIVE_FOLLOW_UP,

        Intent.MCQ:
            ResponseTier.ASSESSMENT,

        Intent.QUIZ:
            ResponseTier.ASSESSMENT,

        Intent.QUESTION_PAPER:
            ResponseTier.ASSESSMENT,

        Intent.ANSWER_SHEET:
            ResponseTier.ASSESSMENT,

        Intent.CHAT:
            ResponseTier.GENERAL_TUTOR,
    }

    def select(
        self,
        intent: Intent,
    ) -> ResponseTier:
        """
        Return the pedagogical response tier for
        the already-detected intent.
        """

        return self._INTENT_TO_TIER.get(
            intent,
            ResponseTier.GENERAL_TUTOR,
        )

    def get_config(
        self,
        tier: ResponseTier,
    ) -> ResponseTierConfig:
        """
        Return immutable pedagogical configuration
        for a response tier.
        """

        return TIER_CONFIGS.get(
            tier,
            TIER_CONFIGS[
                ResponseTier.GENERAL_TUTOR
            ],
        )

    def select_with_config(
        self,
        intent: Intent,
    ) -> tuple[
        ResponseTier,
        ResponseTierConfig,
    ]:
        """
        Convenience method for TutorEngine.

        Returns:
            (response_tier, response_tier_config)
        """

        tier = self.select(intent)

        config = self.get_config(tier)

        return tier, config