"""Draft shape returned by the Word parser. Next.js saves this as an article."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ParsedStep(BaseModel):
    title: str
    body: str = ""
    code: str = ""
    images: list[str] = Field(default_factory=list)


class ParsedCallout(BaseModel):
    title: str = ""
    body: str = ""


class ParsedDraft(BaseModel):
    title: str
    summary: str = ""
    overviewTitle: str = "Overview"
    overview: str = ""
    prerequisitesTitle: str = "Prerequisites"
    prerequisites: list[str] = Field(default_factory=list)
    stepsTitle: str = "Step-by-Step Instructions"
    steps: list[ParsedStep] = Field(default_factory=list)
    verificationTitle: str = "Verification"
    verification: list[str] = Field(default_factory=list)
    verificationCode: str = ""
    troubleshootingTitle: str = "Troubleshooting"
    troubleshooting: list[ParsedCallout] = Field(default_factory=list)
