"""LLM structure step — KBExtractor Protocol and implementations."""

from backend.extractors.factory import get_extractor
from backend.extractors.fake import FakeExtractor
from backend.extractors.openai_compatible import OpenAICompatibleExtractor
from backend.extractors.protocol import KBExtractor

__all__ = [
    "FakeExtractor",
    "KBExtractor",
    "OpenAICompatibleExtractor",
    "get_extractor",
]
