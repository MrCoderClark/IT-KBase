"""Read and sign objects in the uploads bucket.

The browser PUTs the file. This service only signs that PUT and later reads the object.
"""

from __future__ import annotations

import re
from uuid import uuid4

from backend.config import get_storage_settings

_NAME = re.compile(r"[^\w.\- ()]+")


class StorageError(Exception):
    """The object cannot be signed or read. The message is safe to show."""


def owner_segment(user_id: str) -> str:
    return _NAME.sub("", user_id) or "user"


def object_key(user_id: str, filename: str) -> str:
    safe = _NAME.sub("", filename.split("/")[-1].split("\\")[-1]).strip() or "document"
    return f"uploads/{owner_segment(user_id)}/{uuid4().hex}/{safe[:180]}"


def key_allowed(key: str) -> bool:
    return key.startswith("uploads/") and ".." not in key and "\\" not in key


def key_owned(key: str, user_id: str) -> bool:
    return key_allowed(key) and key.startswith(f"uploads/{owner_segment(user_id)}/")


def presign_put(key: str, content_type: str) -> tuple[str, dict[str, str]]:
    client = _client()
    bucket = get_storage_settings().bucket
    url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    return url, {"Content-Type": content_type}


def download_object(key: str) -> bytes:
    if not key_allowed(key):
        raise StorageError("That file is not in storage.")
    client = _client()
    bucket = get_storage_settings().bucket
    try:
        found = client.get_object(Bucket=bucket, Key=key)
    except Exception as exc:  # noqa: BLE001 — a missing object should be a readable error
        raise StorageError("That file is not in storage.") from exc
    body = found["Body"].read()
    if not isinstance(body, bytes):
        raise StorageError("That file is not in storage.")
    return body


def _client():
    settings = get_storage_settings()
    if not settings.bucket or not settings.access_key or not settings.secret_key:
        raise StorageError("Object storage is not configured.")
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:  # pragma: no cover — declared in pyproject
        raise StorageError("Object storage is not installed. From backend/, run uv sync.") from exc
    return boto3.client(
        "s3",
        endpoint_url=settings.endpoint or None,
        region_name=settings.region or "us-east-1",
        aws_access_key_id=settings.access_key,
        aws_secret_access_key=settings.secret_key,
        config=Config(s3={"addressing_style": "path"}),
    )
