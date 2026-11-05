"""Logging setup. Never log resume text, request bodies, or API keys."""
import logging

from app.core.config import settings


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    # Keep third-party HTTP clients from logging request payloads.
    for noisy in ("httpx", "httpcore", "groq"):
        logging.getLogger(noisy).setLevel(logging.WARNING)