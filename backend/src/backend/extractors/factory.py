"""Pick a KBExtractor from AI settings."""

from __future__ import annotations

from backend.config import AiSettings, get_ai_settings
from backend.extractors.openai_compatible import OpenAICompatibleExtractor
from backend.extractors.protocol import KBExtractor


def get_extractor(settings: AiSettings | None = None) -> KBExtractor:
    """Default path: OpenAI-compatible host. Empty `AI_API_KEY` skips the model."""
    ai = settings if settings is not None else get_ai_settings()
    return OpenAICompatibleExtractor(
        api_key=ai.api_key,
        model=ai.model,
        base_url=ai.base_url,
    )
