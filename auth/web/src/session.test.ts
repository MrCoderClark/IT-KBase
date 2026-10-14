import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashSessionSecret,
  isRateLimited,
  LOGIN_LIMIT,
  newSessionSecret,
  nextIdle,
  normalizeEmail,
  safeNextPath,
  SESSION_IDLE_MS,
  sessionDeadlines,
  sessionIsActive,
} from "./session";

describe("session deadlines", () => {
  it("caps idle refresh at the absolute expiry", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const { expiresAt } = sessionDeadlines(now);
    const nearEnd = new Date(expiresAt.getTime() - 60_000);
    const idle = nextIdle(nearEnd, expiresAt);
    assert.equal(idle.getTime(), expiresAt.getTime());
  });

  it("refreshes idle while the absolute expiry is far away", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const { expiresAt } = sessionDeadlines(now);
    const idle = nextIdle(now, expiresAt);
    assert.equal(idle.getTime(), now.getTime() + SESSION_IDLE_MS);
  });

  it("rejects revoked, expired, and idle sessions", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const { expiresAt, idleAt } = sessionDeadlines(now);
    assert.equal(sessionIsActive({ expiresAt, idleAt, revokedAt: null }, now), true);
    assert.equal(sessionIsActive({ expiresAt, idleAt, revokedAt: now }, now), false);
    assert.equal(
      sessionIsActive({ expiresAt: now, idleAt, revokedAt: null }, now),
      false,
    );
    assert.equal(
      sessionIsActive({ expiresAt, idleAt: now, revokedAt: null }, now),
      false,
    );
  });
});

describe("session secret", () => {
  it("stores a hash, not the cookie value", () => {
    const { secret, secretHash } = newSessionSecret();
    assert.notEqual(secret, secretHash);
    assert.equal(secretHash, hashSessionSecret(secret));
    assert.equal(secretHash.length, 64);
  });
});

describe("login guards", () => {
  it("limits the fifth attempt", () => {
    assert.equal(isRateLimited(LOGIN_LIMIT - 1), false);
    assert.equal(isRateLimited(LOGIN_LIMIT), true);
  });

  it("normalizes email and rejects a missing address", () => {
    assert.equal(normalizeEmail("  Joe.Clark@TechBase.Local "), "joe.clark@techbase.local");
    assert.equal(normalizeEmail("not-an-email"), null);
  });

  it("allows only a relative next path", () => {
    assert.equal(safeNextPath("/kb/flush-dns"), "/kb/flush-dns");
    assert.equal(safeNextPath("https://evil.example"), "/");
    assert.equal(safeNextPath("//evil.example"), "/");
    assert.equal(safeNextPath(null), "/");
  });
});
