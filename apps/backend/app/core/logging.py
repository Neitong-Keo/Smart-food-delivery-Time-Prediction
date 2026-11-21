"""Logging configuration for the backend service."""

import logging


def configure_logging(level: str = "INFO") -> None:
    """Configure root logging with a concise structured format."""
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

