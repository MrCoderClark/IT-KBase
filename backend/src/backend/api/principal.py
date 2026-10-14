"""Who the caller is. Health checks stay open; this route does not."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth_py import Principal


class PrincipalResponse(BaseModel):
    kind: Literal["user", "service"]
    user_id: str | None = None
    role: str | None = None


def build_principal_router(dependency) -> APIRouter:
    router = APIRouter(tags=["auth"])
    get_principal = Depends(dependency)

    @router.get("/v1/principal", response_model=PrincipalResponse)
    async def read_principal(principal: Principal = get_principal) -> PrincipalResponse:
        return PrincipalResponse(kind=principal.kind, user_id=principal.user_id, role=principal.role)

    return router
