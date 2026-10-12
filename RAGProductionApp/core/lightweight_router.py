from dataclasses import dataclass
from enum import Enum


class LightweightIntent(str, Enum):
    GREETING = "greeting"
    THANKS = "thanks"
    GOODBYE = "goodbye"


@dataclass(frozen=True)
class LightweightResponse:
    intent: LightweightIntent
    answer: str


class LightweightRouter:

    _GREETINGS = {
        "hi",
        "hello",
        "hey",
        "hii",
        "hiii",
        "good morning",
        "good afternoon",
        "good evening",
    }

    _THANKS = {
        "thanks",
        "thank you",
        "thankyou",
        "thx",
    }

    _GOODBYES = {
        "bye",
        "goodbye",
        "see you",
        "see you later",
    }

    @staticmethod
    def _normalize(text: str) -> str:
        return " ".join(
            (text or "")
            .lower()
            .strip()
            .rstrip("!?.")
            .split()
        )

    def detect(
        self,
        text: str,
    ) -> LightweightResponse | None:

        normalized = self._normalize(text)

        if normalized in self._GREETINGS:
            return LightweightResponse(
                intent=LightweightIntent.GREETING,
                answer=(
                    "Hello! 👋 What would you "
                    "like to study today?"
                ),
            )

        if normalized in self._THANKS:
            return LightweightResponse(
                intent=LightweightIntent.THANKS,
                answer=(
                    "You're welcome! 😊 "
                    "Feel free to ask another question."
                ),
            )

        if normalized in self._GOODBYES:
            return LightweightResponse(
                intent=LightweightIntent.GOODBYE,
                answer=(
                    "Goodbye! 👋 Keep learning, "
                    "and see you next time."
                ),
            )

        return None