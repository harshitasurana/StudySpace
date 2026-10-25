from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# =============================================
# EXISTING MODELS (unchanged — backward compatible)
# =============================================


class ImageAction(str, Enum):
    NONE = "none"
    RETRIEVE = "retrieve"
    GENERATE = "generate"
    RETRIEVE_FIRST = "retrieve_first"


class VideoAction(str, Enum):
    NONE = "none"
    RETRIEVE = "retrieve"
    GENERATE = "generate"


# =============================================
# NEW MODELS (Sprint C extensions)
#
# These are additive only. Nothing above was
# changed, and every new field on MediaDecision
# below has a safe default, so any existing
# caller that only reads wants_image /
# image_action / wants_video / video_action /
# reasons continues to work unmodified.
# =============================================


class MediaStrategy(str, Enum):
    """
    High-level summary of the overall media
    workflow chosen for a question. This is a
    convenience/observability field — the
    authoritative signals for downstream
    execution remain image_action / video_action.
    """

    TEXT_ONLY = "text_only"
    RETRIEVE_IMAGE = "retrieve_image"
    GENERATE_IMAGE = "generate_image"
    RETRIEVE_VIDEO = "retrieve_video"
    GENERATE_VIDEO = "generate_video"
    COMBINED = "combined"


class RetrievalPreference(str, Enum):
    """
    Represents which source should be preferred
    when multiple sources could satisfy the
    media request. Downstream services should
    treat TEXTBOOK_FIRST as "always attempt
    trusted textbook content before falling
    back to generated content".
    """

    NONE = "none"
    TEXTBOOK_FIRST = "textbook_first"
    GENERATED_FIRST = "generated_first"


class MediaDecision(BaseModel):
    # -----------------------------------------
    # Existing fields — unchanged
    # -----------------------------------------

    wants_image: bool = False

    image_action: ImageAction = (
        ImageAction.NONE
    )

    wants_video: bool = False

    video_action: VideoAction = (
        VideoAction.NONE
    )

    reasons: List[str] = Field(
        default_factory=list
    )

    # -----------------------------------------
    # New fields — all optional / defaulted
    # -----------------------------------------

    # Secondary image action used only for
    # combined requests, e.g. "Explain the
    # human heart and draw a simplified
    # version" -> primary=RETRIEVE_FIRST,
    # secondary=GENERATE.
    secondary_image_action: ImageAction = (
        ImageAction.NONE
    )

    # True whenever more than one media action
    # (image + image, or image + video) is
    # required to fully answer the question.
    is_combined: bool = False

    # High-level summary of the decision, for
    # logging/observability/downstream routing.
    media_strategy: MediaStrategy = (
        MediaStrategy.TEXT_ONLY
    )

    # Set when the student explicitly referenced
    # a specific textbook figure, e.g.
    # "Figure 4.2", "Fig. 2.3", "the diagram on
    # page 18", "the graph above". Used to drive
    # targeted retrieval instead of a generic
    # topical search.
    reference_label: Optional[str] = None

    # Rough confidence score (0.0 - 1.0) in the
    # media decision, for analytics/tuning only.
    confidence: float = 0.0

    # Which source (textbook vs generated) should
    # be preferred for this decision.
    retrieval_preference: RetrievalPreference = (
        RetrievalPreference.NONE
    )