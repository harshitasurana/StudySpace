import logging

from dotenv import load_dotenv
from langfuse import get_client


logger = logging.getLogger(__name__)

# Load .env before Langfuse client initialization
load_dotenv()

# Langfuse v4 client
langfuse = get_client()


def verify_langfuse_connection() -> bool:
    """
    Verify that the application can authenticate
    with the configured Langfuse instance.

    Use during setup/debugging only.
    Do not call on every student request.
    """
    try:
        authenticated = langfuse.auth_check()

        if authenticated:
            logger.info(
                "Langfuse authentication successful."
            )
        else:
            logger.error(
                "Langfuse authentication failed."
            )

        return authenticated

    except Exception:
        logger.exception(
            "Langfuse connection check failed."
        )
        return False


def flush_langfuse() -> None:
    """
    Flush queued observations.

    Useful during local development and shutdown.
    Do not call after every nested span.
    """
    try:
        langfuse.flush()

    except Exception:
        logger.exception(
            "Failed to flush Langfuse observations."
        )
