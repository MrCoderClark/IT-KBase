"""Object keys stay under the signed-in user's uploads prefix."""

from backend.storage import key_allowed, key_owned, object_key


def test_a_key_stays_under_that_user() -> None:
    key = object_key("user-1", r"..\secret.pdf")
    assert key.startswith("uploads/user-1/")
    assert key.endswith("secret.pdf")
    assert ".." not in key


def test_another_prefix_is_refused() -> None:
    assert key_owned("uploads/user-1/abc/runbook.docx", "user-1")
    assert not key_owned("uploads/other/abc/runbook.docx", "user-1")
    assert not key_owned("uploads/../secret", "user-1")
    assert key_allowed("uploads/user-1/abc/runbook.docx")
    assert not key_allowed("/etc/passwd")
