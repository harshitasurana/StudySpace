import re

from core.media_types import (
    ImageAction,
    MediaDecision,
    MediaStrategy,
    RetrievalPreference,
    VideoAction,
)


class MediaOrchestrator:
    """
    Intelligent routing layer for all media-related
    decisions.

    IMPORTANT: This class never retrieves or generates
    media itself. It only decides *what* media workflow
    (if any) should be executed downstream:

        - text only
        - retrieve textbook figure(s)
        - generate an image
        - retrieve a video
        - generate a video
        - a combination of the above

    Downstream services (ImageService.retrieve(),
    image generation, video retrieval/generation) are
    invoked by the backend based on the MediaDecision
    this class returns.
    """

    # =====================================
    # EXPLICIT IMAGE GENERATION
    # =====================================

    IMAGE_GENERATE_PATTERNS = (
        r"\bgenerate\b.*\bimage\b",
        r"\bcreate\b.*\bimage\b",
        r"\bmake\b.*\bimage\b",
        r"\bdraw\b.*\bdiagram\b",
        r"\bcreate\b.*\bdiagram\b",
        r"\bgenerate\b.*\bdiagram\b",
        r"\bvisualize\b.*\bdiagram\b",
        r"\bgenerate\b.*\billustration\b",
        r"\bcreate\b.*\billustration\b",
        r"\bmake\b.*\billustration\b",
        r"\bvisualize\b.*\bprocess\b",
        r"\bdraw\b.*\b(simplified|simple|version)\b",
        r"\bsketch\b.*\bdiagram\b",
        r"\blabeled diagram\b",
    )

    # =====================================
    # EXPLICIT IMAGE RETRIEVAL
    # =====================================

    IMAGE_RETRIEVE_PATTERNS = (
        r"\bshow\b.*\bimage\b",
        r"\bshow\b.*\bpicture\b",
        r"\bshow\b.*\bdiagram\b",
        r"\bfind\b.*\bimage\b",
        r"\bfind\b.*\bdiagram\b",
        r"\btextbook\b.*\bimage\b",
        r"\bbook\b.*\bdiagram\b",
        r"\bshow\b.*\bgraph\b",
        r"\bshow\b.*\bfigure\b",
        r"\bwhere\b.*\bshown\b.*\btextbook\b",
        r"\busing\b.*\bfigure\b",
        r"\bwith\b.*\bfigure\b",
        r"\bexplain\b.*\bfigure\b",
    )

    # =====================================
    # EXPLICIT VISUAL EXPLANATION
    # =====================================

    IMAGE_VISUAL_PATTERNS = (
        r"\bexplain\b.*\bvisually\b",
        r"\bvisual explanation\b",
        r"\bwith\b.*\bdiagram\b",
        r"\busing\b.*\bdiagram\b",
        r"\bvisualize\b",
    )

    # =====================================
    # IMPLICIT VISUAL NEED
    # =====================================

    IMPLICIT_VISUAL_PATTERNS = (

        # Mathematics: graphs / coordinates
        r"\bgraph\b",
        r"\bplot\b",
        r"\bcoordinate plane\b",
        r"\bcartesian plane\b",
        r"\bcoordinate geometry\b",
        r"\bx-axis\b",
        r"\by-axis\b",
        r"\bquadrant\b",
        r"\bslope\b",

        # Geometry
        r"\btriangle\b",
        r"\bcircle\b",
        r"\bpolygon\b",
        r"\bangle\b",
        r"\bparallel lines\b",
        r"\bperpendicular\b",
        r"\breflection\b",
        r"\brotation\b",
        r"\bsymmetry\b",

        # Science structures
        r"\bcell structure\b",
        r"\banatomy\b",
        r"\bstructure of\b",
        r"\bparts of\b",

        # Human / plant anatomy
        r"\bhuman heart\b",
        r"\bheart\b",
        r"\blungs?\b",
        r"\bdigestive system\b",
        r"\brespiratory system\b",
        r"\bcirculatory system\b",
        r"\bnervous system\b",
        r"\bskeletal system\b",
        r"\bhuman body\b",
        r"\bplant cell\b",
        r"\banimal cell\b",
        r"\broot system\b",

        # Physics
        r"\bray diagram\b",
        r"\breflection of light\b",
        r"\brefraction\b",
        r"\bcircuit\b",
        r"\belectric circuit\b",
        r"\bforce diagram\b",

        # Processes / cycles
        r"\bcycle\b",
        r"\bprocess of\b",
        r"\bflow of\b",
        r"\bstages of\b",

        # Textbook figure references
        r"\bfig\.\s*\d+",
        r"\bfigure\s+\d+",
        r"\bshown in the figure\b",
    )

    # =====================================
    # STRONG VISUAL ACTION PATTERNS
    # =====================================

    VISUAL_ACTION_PATTERNS = (
        r"\bplot\b",
        r"\bdraw\b",
        r"\bconstruct\b",
        r"\bmark\b",
        r"\blocate\b",
        r"\btrace\b",
        r"\bsketch\b",
        r"\bcompare\b",
        r"\bidentify\b",
        r"\bexplain\b",
        r"\bdescribe\b",
        r"\bshow\b",
        r"\bhow does\b",
        r"\bhow do\b",
    )

    # =====================================
    # VIDEO RETRIEVAL
    # =====================================

    VIDEO_RETRIEVE_PATTERNS = (
        r"\bshow\b.*\bvideo\b",
        r"\bfind\b.*\bvideo\b",
        r"\bplay\b.*\bvideo\b",
        r"\buploaded\b.*\bvideo\b",
        r"\bfind\b.*\blesson\b",
        r"\bplay\b.*\banimation\b",
        r"\bshow\b.*\blesson\b",
    )

    # =====================================
    # VIDEO GENERATION
    # =====================================

    VIDEO_GENERATE_PATTERNS = (
        r"\bgenerate\b.*\bvideo\b",
        r"\bcreate\b.*\bvideo\b",
        r"\bmake\b.*\bvideo\b",
        r"\bgenerate\b.*\banimation\b",
        r"\bcreate\b.*\blearning video\b",
    )

    # =====================================
    # EXPLICIT FIGURE REFERENCE
    # (e.g. "Figure 2.3", "Fig. 4.2",
    # "diagram on page 18", "the graph above")
    # =====================================

    FIGURE_NUMBER_PATTERN = re.compile(
        r"\bfig(?:ure)?\.?\s*(\d+(?:\.\d+)?)\b",
        flags=re.IGNORECASE,
    )

    FIGURE_PAGE_PATTERN = re.compile(
        r"\bdiagram\s+(?:shown\s+)?on\s+page\s*(\d+)\b",
        flags=re.IGNORECASE,
    )

    FIGURE_ABOVE_PATTERN = re.compile(
        r"\bthe\s+(graph|diagram|figure|image|"
        r"illustration)\s+above\b",
        flags=re.IGNORECASE,
    )

    # =====================================
    # CONJUNCTION
    # (used to detect combined / multi-part
    # requests, e.g. "... and draw ...")
    # =====================================

    CONJUNCTION_PATTERN = re.compile(
        r"\band\b",
        flags=re.IGNORECASE,
    )

    # =====================================
    # DETECT
    # =====================================

    def detect(
        self,
        question: str,
    ) -> MediaDecision:

        normalized = self._normalize(
            question
        )

        reasons = []

        # =================================
        # FIGURE REFERENCE DETECTION
        # =================================

        reference_label = (
            self._detect_figure_reference(
                normalized
            )
        )

        # =================================
        # RAW SIGNAL DETECTION
        # (checked independently so we can
        # also recognise combined requests,
        # not just the single strongest one)
        # =================================

        generate_match = self._matches(
            normalized,
            self.IMAGE_GENERATE_PATTERNS,
        )

        retrieve_match = self._matches(
            normalized,
            self.IMAGE_RETRIEVE_PATTERNS,
        )

        visual_match = self._matches(
            normalized,
            self.IMAGE_VISUAL_PATTERNS,
        )

        implicit_match = (
            self._needs_implicit_visual(
                normalized
            )
        )

        has_other_visual_signal = (
            retrieve_match
            or visual_match
            or implicit_match
        )

        has_conjunction = bool(
            self.CONJUNCTION_PATTERN.search(
                normalized
            )
        )

        # =================================
        # IMAGE DECISION
        #
        # Priority:
        # 1. Explicit figure reference
        #    (e.g. "Figure 4.2") — retrieve
        #    the exact figure.
        # 2. Combined request — explicit
        #    generate cue joined with another
        #    visual cue via a conjunction
        #    (e.g. "explain the heart and
        #    draw a simplified version").
        # 3. GENERATE > RETRIEVE > EXPLICIT
        #    VISUAL > IMPLICIT
        # =================================

        image_action = ImageAction.NONE
        secondary_image_action = (
            ImageAction.NONE
        )
        is_combined = False
        image_confidence = 0.9

        if reference_label:

            image_action = ImageAction.RETRIEVE
            image_confidence = 0.95

            reasons.append(
                "Explicit textbook figure "
                f"reference detected "
                f"({reference_label}); "
                "prioritizing retrieval of "
                "the exact figure."
            )

            if generate_match:
                secondary_image_action = (
                    ImageAction.GENERATE
                )
                is_combined = True

                reasons.append(
                    "Additional image "
                    "generation requested "
                    "alongside the "
                    "referenced figure."
                )

        elif (
            generate_match
            and has_other_visual_signal
            and has_conjunction
        ):

            image_action = (
                ImageAction.RETRIEVE_FIRST
            )
            secondary_image_action = (
                ImageAction.GENERATE
            )
            is_combined = True
            image_confidence = 0.85

            reasons.append(
                "Combined media request "
                "detected: retrieving "
                "textbook figure and "
                "generating a supplementary "
                "image."
            )

        elif generate_match:

            image_action = ImageAction.GENERATE
            image_confidence = 0.9

            reasons.append(
                "Explicit image generation "
                "request detected."
            )

        elif retrieve_match:

            image_action = ImageAction.RETRIEVE
            image_confidence = 0.9

            reasons.append(
                "Explicit image retrieval "
                "request detected."
            )

        elif visual_match:

            image_action = (
                ImageAction.RETRIEVE_FIRST
            )
            image_confidence = 0.8

            reasons.append(
                "Explicit visual explanation "
                "request detected."
            )

        elif implicit_match:

            image_action = (
                ImageAction.RETRIEVE_FIRST
            )
            image_confidence = 0.6

            reasons.append(
                "Question benefits from "
                "visual textbook context."
            )

        # =================================
        # VIDEO DECISION
        # =================================

        video_action = VideoAction.NONE
        video_confidence = 0.0

        if self._matches(
            normalized,
            self.VIDEO_GENERATE_PATTERNS,
        ):
            video_action = (
                VideoAction.GENERATE
            )
            video_confidence = 0.9

            reasons.append(
                "Explicit video generation "
                "request detected."
            )

        elif self._matches(
            normalized,
            self.VIDEO_RETRIEVE_PATTERNS,
        ):
            video_action = (
                VideoAction.RETRIEVE
            )
            video_confidence = 0.9

            reasons.append(
                "Explicit video retrieval "
                "request detected."
            )

        wants_image = (
            image_action != ImageAction.NONE
        )

        wants_video = (
            video_action != VideoAction.NONE
        )

        if not wants_image and not wants_video:
            reasons.append(
                "No visual or media need "
                "detected; text-only response "
                "is sufficient."
            )

        if wants_image and wants_video:
            is_combined = True

        # =================================
        # MEDIA STRATEGY (summary)
        # =================================

        media_strategy = (
            self._resolve_strategy(
                is_combined=is_combined,
                wants_image=wants_image,
                wants_video=wants_video,
                image_action=image_action,
                video_action=video_action,
            )
        )

        # =================================
        # RETRIEVAL PREFERENCE
        # =================================

        if image_action in (
            ImageAction.RETRIEVE,
            ImageAction.RETRIEVE_FIRST,
        ):
            retrieval_preference = (
                RetrievalPreference
                .TEXTBOOK_FIRST
            )
        elif image_action == (
            ImageAction.GENERATE
        ):
            retrieval_preference = (
                RetrievalPreference
                .GENERATED_FIRST
            )
        else:
            retrieval_preference = (
                RetrievalPreference.NONE
            )

        confidence = max(
            image_confidence,
            video_confidence,
        )

        return MediaDecision(
            wants_image=wants_image,
            image_action=image_action,
            secondary_image_action=(
                secondary_image_action
            ),
            wants_video=wants_video,
            video_action=video_action,
            reasons=reasons,
            is_combined=is_combined,
            media_strategy=media_strategy,
            reference_label=reference_label,
            confidence=confidence,
            retrieval_preference=(
                retrieval_preference
            ),
        )

    # =====================================
    # STRATEGY RESOLUTION
    # =====================================

    @staticmethod
    def _resolve_strategy(
        is_combined: bool,
        wants_image: bool,
        wants_video: bool,
        image_action: "ImageAction",
        video_action: "VideoAction",
    ) -> "MediaStrategy":

        if is_combined:
            return MediaStrategy.COMBINED

        if wants_image and not wants_video:

            if image_action == (
                ImageAction.GENERATE
            ):
                return (
                    MediaStrategy.GENERATE_IMAGE
                )

            return MediaStrategy.RETRIEVE_IMAGE

        if wants_video and not wants_image:

            if video_action == (
                VideoAction.GENERATE
            ):
                return (
                    MediaStrategy.GENERATE_VIDEO
                )

            return MediaStrategy.RETRIEVE_VIDEO

        return MediaStrategy.TEXT_ONLY

    # =====================================
    # FIGURE REFERENCE DETECTION
    # =====================================

    def _detect_figure_reference(
        self,
        text: str,
    ) -> str | None:

        match = (
            self.FIGURE_NUMBER_PATTERN.search(
                text
            )
        )

        if match:
            return f"Figure {match.group(1)}"

        match = (
            self.FIGURE_PAGE_PATTERN.search(
                text
            )
        )

        if match:
            return (
                f"Diagram on page "
                f"{match.group(1)}"
            )

        match = (
            self.FIGURE_ABOVE_PATTERN.search(
                text
            )
        )

        if match:
            return (
                f"The {match.group(1)} above"
            )

        return None

    # =====================================
    # IMPLICIT VISUAL DECISION
    # =====================================

    def _needs_implicit_visual(
        self,
        text: str,
    ) -> bool:

        has_visual_concept = self._matches(
            text,
            self.IMPLICIT_VISUAL_PATTERNS,
        )

        if not has_visual_concept:
            return False

        # ---------------------------------
        # Strong graph / coordinate cases
        # Always benefit from visuals
        # ---------------------------------

        strong_visual_patterns = (
            r"\bgraph\b",
            r"\bplot\b",
            r"\bcoordinate plane\b",
            r"\bcartesian plane\b",
            r"\bx-axis\b",
            r"\by-axis\b",
            r"\bquadrant\b",
            r"\bray diagram\b",
            r"\bforce diagram\b",
            r"\bfig\.\s*\d+",
            r"\bfigure\s+\d+",
            r"\bshown in the figure\b",
        )

        if self._matches(
            text,
            strong_visual_patterns,
        ):
            return True

        # ---------------------------------
        # Other concepts need both:
        # visual concept + action signal
        #
        # Example:
        # "Define triangle" -> False
        # "Explain triangle construction"
        # -> True
        # "Explain the human heart" -> True
        # ---------------------------------

        has_visual_action = self._matches(
            text,
            self.VISUAL_ACTION_PATTERNS,
        )

        return has_visual_action

    # =====================================
    # NORMALIZE
    # =====================================

    @staticmethod
    def _normalize(
        text: str,
    ) -> str:

        return " ".join(
            text.lower().strip().split()
        )

    # =====================================
    # REGEX MATCH
    # =====================================

    @staticmethod
    def _matches(
        text: str,
        patterns: tuple[str, ...],
    ) -> bool:

        return any(
            re.search(
                pattern,
                text,
                flags=re.IGNORECASE,
            )
            for pattern in patterns
        )