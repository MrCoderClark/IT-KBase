"""POST /assistant/diff-summary and the reviewer (AI-4 C1). No real model call."""

from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from auth_py.assertion import AssertionClaims, mint_assertion
from backend.app import create_app
from backend.assistant.review import (
    DiffSummaryRequest,
    FakeReviewer,
    FeedbackDigestRequest,
    GapClusteringRequest,
    GapItem,
    OpenAICompatibleReviewer,
    ReviewError,
    SectionChange,
)
from backend.config import get_settings

NOW = datetime(2026, 11, 12, 16, 0, tzinfo=UTC)
SECRET = b"test-assertion-key"
SERVICE_TOKEN = "sv_test_worker"

CHANGES = [
    SectionChange(
        title="Step-by-Step",
        status="changed",
        before="Run on Windows 10.",
        after="Run on Windows 11 24H2.",
    ),
    SectionChange(title="Troubleshooting", status="added", after="BitLocker recovery steps."),
]


class _FrozenClock:
    @staticmethod
    def now(_tz=None):
        return NOW


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("TB_ASSERTION_KEYS", "k1:test-assertion-key")
    monkeypatch.setenv("TB_SERVICE_TOKENS", SERVICE_TOKEN)
    monkeypatch.setenv("TB_ENV", "preview")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        yield client
    get_settings.cache_clear()


def _user(monkeypatch: pytest.MonkeyPatch, role: str = "reviewer") -> dict[str, str]:
    monkeypatch.setattr("auth_py.dependency.datetime", _FrozenClock)
    token = mint_assertion(
        AssertionClaims(
            aud="ingestion",
            exp=int(NOW.timestamp()) + 60,
            gen=1,
            iat=int(NOW.timestamp()),
            kid="k1",
            role=role,
            sub="id1",
            uid="user1",
        ),
        SECRET,
    )
    return {"Authorization": f"Bearer {token}"}


def _use_reviewer(monkeypatch: pytest.MonkeyPatch, reviewer: object | None) -> None:
    monkeypatch.setattr("backend.api.assistant.get_reviewer", lambda: reviewer)


def _request(changes: list[SectionChange] | None = None) -> DiffSummaryRequest:
    return DiffSummaryRequest(
        title="Reset the admin password",
        from_version="1.0",
        to_version="1.1",
        changes=CHANGES if changes is None else changes,
    )


# --- reviewer --------------------------------------------------------------


def test_summarizes_a_diff() -> None:
    written = {
        "summary": "Updates the steps to Windows 11 and adds BitLocker recovery.",
        "changes": ["Step-by-Step now targets Windows 11 24H2", "Adds Troubleshooting"],
    }
    reviewer = OpenAICompatibleReviewer(
        api_key="k", model="m", base_url="u", complete=lambda _m: json.dumps(written)
    )
    result = reviewer.summarize_diff(_request())
    assert "Windows 11" in result.summary
    assert result.changes == [
        "Step-by-Step now targets Windows 11 24H2",
        "Adds Troubleshooting",
    ]


def test_grounds_the_model_in_the_diff_text() -> None:
    seen: dict[str, str] = {}

    def complete(messages: list[dict[str, str]]) -> str:
        seen["user"] = messages[-1]["content"]
        return json.dumps({"summary": "ok", "changes": []})

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    reviewer.summarize_diff(_request())
    assert "Step-by-Step" in seen["user"]
    assert "Windows 11 24H2" in seen["user"]  # the "after" text reaches the model
    assert "[added]" in seen["user"]  # status is labelled


def test_no_changes_short_circuits_without_a_model_call() -> None:
    def complete(_messages: list[dict[str, str]]) -> str:
        raise AssertionError("the model must not be called when nothing changed")

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    result = reviewer.summarize_diff(_request(changes=[]))
    assert result.changes == []
    assert "No sections differ" in result.summary


def test_one_repair_then_success() -> None:
    calls: list[object] = []

    def complete(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return "not json" if len(calls) == 1 else json.dumps({"summary": "Fixed", "changes": []})

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    result = reviewer.summarize_diff(_request())
    assert result.summary == "Fixed"
    assert len(calls) == 2  # original + one repair


def test_invalid_twice_raises_review_error() -> None:
    reviewer = OpenAICompatibleReviewer(
        api_key="k", model="m", base_url="u", complete=lambda _m: "still not json"
    )
    with pytest.raises(ReviewError):
        reviewer.summarize_diff(_request())


def test_fake_reviewer_names_changed_sections() -> None:
    result = FakeReviewer().summarize_diff(_request())
    assert "2 sections" in result.summary
    assert any("Step-by-Step" in bullet for bullet in result.changes)
    assert any("Troubleshooting" in bullet for bullet in result.changes)


# --- feedback digest -------------------------------------------------------

COMMENTS = ["Step 3 is wrong on Windows 11.", "The command in step 3 fails.", "Missing the reboot."]


def _digest_request(comments: list[str] | None = None) -> FeedbackDigestRequest:
    return FeedbackDigestRequest(
        title="Reset the admin password",
        comments=COMMENTS if comments is None else comments,
    )


def test_digests_feedback_into_themes_and_suggestions() -> None:
    written = {
        "summary": "Readers report step 3 is broken on Windows 11.",
        "themes": ["Step 3 command fails", "No reboot step"],
        "suggestions": ["Fix the step 3 command for Windows 11", "Add the reboot step"],
    }
    reviewer = OpenAICompatibleReviewer(
        api_key="k", model="m", base_url="u", complete=lambda _m: json.dumps(written)
    )
    result = reviewer.digest_feedback(_digest_request())
    assert result.themes == ["Step 3 command fails", "No reboot step"]
    assert len(result.suggestions) == 2


def test_digest_grounds_the_model_in_the_comments() -> None:
    seen: dict[str, str] = {}

    def complete(messages: list[dict[str, str]]) -> str:
        seen["user"] = messages[-1]["content"]
        return json.dumps({"summary": "ok", "themes": [], "suggestions": []})

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    reviewer.digest_feedback(_digest_request())
    assert "Missing the reboot." in seen["user"]


def test_digest_no_comments_short_circuits_without_a_model_call() -> None:
    def complete(_messages: list[dict[str, str]]) -> str:
        raise AssertionError("the model must not be called with no comments")

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    result = reviewer.digest_feedback(_digest_request(comments=["", "   "]))
    assert result.themes == []
    assert "No written not-helpful feedback" in result.summary


def test_digest_one_repair_then_success() -> None:
    calls: list[object] = []

    def complete(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return "nope" if len(calls) == 1 else json.dumps({"summary": "ok", "themes": ["t"], "suggestions": []})

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    result = reviewer.digest_feedback(_digest_request())
    assert result.themes == ["t"]
    assert len(calls) == 2


def test_fake_reviewer_digests_feedback() -> None:
    result = FakeReviewer().digest_feedback(_digest_request())
    assert "3 not-helpful comments" in result.summary
    assert len(result.themes) == 1


# --- endpoint --------------------------------------------------------------


def _body() -> dict[str, object]:
    return {
        "title": "Reset the admin password",
        "fromVersion": "1.0",
        "toVersion": "1.1",
        "changes": [
            {"title": "Step-by-Step", "status": "changed", "before": "Win 10", "after": "Win 11"},
            {"title": "Troubleshooting", "status": "added", "after": "BitLocker recovery."},
        ],
    }


def test_reviewer_summarizes_a_diff(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/diff-summary", json=_body(), headers=_user(monkeypatch, "reviewer")
    )
    assert response.status_code == 200
    data = response.json()
    assert "2 sections" in data["summary"]
    assert len(data["changes"]) == 2


def test_requires_reviewer(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/diff-summary", json=_body(), headers=_user(monkeypatch, "author")
    )
    assert response.status_code == 403


def test_service_token_is_allowed(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/diff-summary",
        json=_body(),
        headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
    )
    assert response.status_code == 200


def test_requires_a_caller(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post("/assistant/diff-summary", json=_body())
    assert response.status_code == 401


def test_not_configured_is_503(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, None)
    response = api.post(
        "/assistant/diff-summary", json=_body(), headers=_user(monkeypatch, "reviewer")
    )
    assert response.status_code == 503


# --- feedback-digest endpoint ----------------------------------------------


def _digest_body() -> dict[str, object]:
    return {"title": "Reset the admin password", "comments": COMMENTS}


def test_reviewer_digests_feedback(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/feedback-digest", json=_digest_body(), headers=_user(monkeypatch, "reviewer")
    )
    assert response.status_code == 200
    data = response.json()
    assert "3 not-helpful comments" in data["summary"]
    assert len(data["themes"]) == 1


def test_digest_requires_reviewer(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/feedback-digest", json=_digest_body(), headers=_user(monkeypatch, "author")
    )
    assert response.status_code == 403


def test_digest_service_token_is_allowed(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/feedback-digest",
        json=_digest_body(),
        headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
    )
    assert response.status_code == 200


def test_digest_not_configured_is_503(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, None)
    response = api.post(
        "/assistant/feedback-digest", json=_digest_body(), headers=_user(monkeypatch, "reviewer")
    )
    assert response.status_code == 503


# --- gap clustering --------------------------------------------------------

GAPS = [
    GapItem(id="0", question="How do I re-register MFA?"),
    GapItem(id="1", question="Reset my authenticator app"),
    GapItem(id="2", question="VPN won't connect from home"),
]


def _cluster_request(gaps: list[GapItem] | None = None) -> GapClusteringRequest:
    return GapClusteringRequest(gaps=GAPS if gaps is None else gaps)


def test_clusters_gaps_into_labelled_themes() -> None:
    written = {
        "clusters": [
            {"label": "MFA re-registration", "theme": "Resetting MFA.", "members": ["0", "1"]},
            {"label": "VPN", "theme": "Home VPN issues.", "members": ["2"]},
        ]
    }
    reviewer = OpenAICompatibleReviewer(
        api_key="k", model="m", base_url="u", complete=lambda _m: json.dumps(written)
    )
    result = reviewer.cluster_gaps(_cluster_request())
    assert [c.label for c in result.clusters] == ["MFA re-registration", "VPN"]
    assert result.clusters[0].gap_ids == ["0", "1"]


def test_cluster_drops_unlisted_ids_and_empty_clusters() -> None:
    written = {
        "clusters": [
            {"label": "MFA", "theme": "", "members": ["0", "99", "0"]},  # dedup + drop 99
            {"label": "Ghost", "theme": "", "members": ["42"]},  # all invalid → dropped
            {"label": "", "theme": "x", "members": ["2"]},  # no label → dropped
        ]
    }
    reviewer = OpenAICompatibleReviewer(
        api_key="k", model="m", base_url="u", complete=lambda _m: json.dumps(written)
    )
    result = reviewer.cluster_gaps(_cluster_request())
    assert len(result.clusters) == 1
    assert result.clusters[0].gap_ids == ["0"]


def test_cluster_grounds_the_model_in_the_questions() -> None:
    seen: dict[str, str] = {}

    def complete(messages: list[dict[str, str]]) -> str:
        seen["user"] = messages[-1]["content"]
        return json.dumps({"clusters": []})

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    reviewer.cluster_gaps(_cluster_request())
    assert "[0] How do I re-register MFA?" in seen["user"]
    assert "[2] VPN won't connect from home" in seen["user"]


def test_cluster_under_two_gaps_short_circuits_without_a_model_call() -> None:
    def complete(_messages: list[dict[str, str]]) -> str:
        raise AssertionError("the model must not be called with fewer than two gaps")

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    result = reviewer.cluster_gaps(_cluster_request(gaps=[GapItem(id="0", question="only one")]))
    assert result.clusters == []


def test_cluster_one_repair_then_success() -> None:
    calls: list[object] = []

    def complete(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return "nope" if len(calls) == 1 else json.dumps(
            {"clusters": [{"label": "MFA", "theme": "", "members": ["0", "1"]}]}
        )

    reviewer = OpenAICompatibleReviewer(api_key="k", model="m", base_url="u", complete=complete)
    result = reviewer.cluster_gaps(_cluster_request())
    assert result.clusters[0].label == "MFA"
    assert len(calls) == 2


def test_fake_reviewer_clusters_all_gaps() -> None:
    result = FakeReviewer().cluster_gaps(_cluster_request())
    assert len(result.clusters) == 1
    assert result.clusters[0].gap_ids == ["0", "1", "2"]


# --- cluster-gaps endpoint -------------------------------------------------


def _cluster_body() -> dict[str, object]:
    return {"gaps": [{"id": gap.id, "question": gap.question} for gap in GAPS]}


def test_reviewer_clusters_gaps(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/cluster-gaps", json=_cluster_body(), headers=_user(monkeypatch, "reviewer")
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["clusters"]) == 1
    assert data["clusters"][0]["gapIds"] == ["0", "1", "2"]


def test_cluster_requires_reviewer(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/cluster-gaps", json=_cluster_body(), headers=_user(monkeypatch, "author")
    )
    assert response.status_code == 403


def test_cluster_service_token_is_allowed(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, FakeReviewer())
    response = api.post(
        "/assistant/cluster-gaps",
        json=_cluster_body(),
        headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
    )
    assert response.status_code == 200


def test_cluster_not_configured_is_503(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_reviewer(monkeypatch, None)
    response = api.post(
        "/assistant/cluster-gaps", json=_cluster_body(), headers=_user(monkeypatch, "reviewer")
    )
    assert response.status_code == 503
