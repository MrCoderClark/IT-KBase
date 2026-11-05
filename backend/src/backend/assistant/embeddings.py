"""Embeddings for AI Assistant retrieval (spec 20 §5.2, ADR 0004).

Reads only `ASSISTANT_*` settings. Ingestion's `AI_*` config and extractor are
never touched. Every response is checked for count and dimension so a wrong
vector size can never reach `ArticleChunk.embedding vector(1536)`.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol
from urllib import error, request

from backend.config import AssistantSettings, get_assistant_settings

_TIMEOUT_S = 30

PostJson = Callable[[str, dict[str, str], dict[str, Any]], Any]


class EmbeddingError(RuntimeError):
    """The provider failed or returned something unusable. Message is safe to show."""


@dataclass(frozen=True)
class Embeddings:
    vectors: list[list[float]]
    prompt_tokens: int


class Embedder(Protocol):
    model: str
    dimensions: int

    def embed(self, texts: list[str]) -> Embeddings: ...


class OpenAICompatibleEmbedder:
    """`POST {base_url}/embeddings` on OpenRouter or any OpenAI-compatible host."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        dimensions: int,
        post: PostJson | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self.model = model
        self.dimensions = dimensions
        self._post = post or _post_json

    def embed(self, texts: list[str]) -> Embeddings:
        if not texts:
            return Embeddings(vectors=[], prompt_tokens=0)
        url = self._base_url.rstrip("/") + "/embeddings"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3001",
            "X-Title": "TechBase Assistant",
        }
        payload = {
            "model": self.model,
            "input": texts,
            "dimensions": self.dimensions,
            "encoding_format": "float",
        }
        try:
            body = self._post(url, headers, payload)
        except error.HTTPError as exc:
            raise EmbeddingError(f"Embedding provider returned HTTP {exc.code}.") from exc
        except (OSError, ValueError) as exc:
            raise EmbeddingError("Embedding provider could not be reached.") from exc
        return _parse(body, expected=len(texts), dimensions=self.dimensions)


class FakeEmbedder:
    """Deterministic unit vectors from a hash of the text. Tests and offline dev only."""

    model = "fake-embedding"

    def __init__(self, dimensions: int = 1536) -> None:
        self.dimensions = dimensions

    def embed(self, texts: list[str]) -> Embeddings:
        return Embeddings(
            vectors=[_hash_vector(text, self.dimensions) for text in texts],
            prompt_tokens=sum(len(text.split()) for text in texts),
        )


def get_embedder(settings: AssistantSettings | None = None) -> Embedder | None:
    """Embedder from `ASSISTANT_*`, or None when `ASSISTANT_API_KEY` is missing."""
    current = settings if settings is not None else get_assistant_settings()
    if not current.enabled:
        return None
    return OpenAICompatibleEmbedder(
        api_key=current.api_key,
        base_url=current.base_url,
        model=current.embedding_model,
        dimensions=current.embedding_dimensions,
    )


def _post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> Any:
    call = request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    with request.urlopen(call, timeout=_TIMEOUT_S) as response:
        return json.loads(response.read().decode())


def _parse(body: Any, *, expected: int, dimensions: int) -> Embeddings:
    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, list) or len(data) != expected:
        raise EmbeddingError("Embedding provider returned the wrong number of vectors.")
    if not all(isinstance(item, dict) for item in data):
        raise EmbeddingError("Embedding provider returned an unreadable response.")
    vectors: list[list[float]] = []
    for item in sorted(data, key=lambda row: int(row.get("index", 0))):
        vector = item.get("embedding")
        if not isinstance(vector, list) or len(vector) != dimensions:
            raise EmbeddingError(
                f"Embedding provider returned vectors of the wrong size (expected {dimensions})."
            )
        vectors.append([float(value) for value in vector])
    usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
    tokens = int(usage.get("prompt_tokens") or usage.get("total_tokens") or 0)
    return Embeddings(vectors=vectors, prompt_tokens=tokens)


def _hash_vector(text: str, dimensions: int) -> list[float]:
    values: list[float] = []
    counter = 0
    while len(values) < dimensions:
        digest = hashlib.sha256(f"{counter}:{text}".encode()).digest()
        values.extend((byte - 127.5) / 127.5 for byte in digest)
        counter += 1
    values = values[:dimensions]
    norm = math.sqrt(sum(value * value for value in values)) or 1.0
    return [value / norm for value in values]
