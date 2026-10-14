import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginWithPassword } from "./login";
import { LOGIN_LIMIT } from "./session";
import type { AuthStore, IdentityRecord } from "./types";

const NOW = new Date("2026-10-14T16:00:00Z");

const verified: IdentityRecord = {
  id: "id1",
  email: "joe@example.com",
  passwordHash: "hash-ok",
  emailVerified: new Date("2026-10-01T00:00:00Z"),
  disabledAt: null,
};

describe("login", () => {
  it("records a success and a failure without saying which check failed", async () => {
    const store = memoryStore([verified]);
    const ok = await loginWithPassword({
      store,
      hasher: hasherFor("hash-ok"),
      email: "Joe@Example.com",
      password: "correct-password",
      now: NOW,
      ip: "10.0.0.8",
      userAgent: "test",
    });
    assert.equal(ok.ok, true);
    assert.equal(store.sessions.length, 1);
    assert.equal(store.audits.at(-1)?.action, "login_succeeded");

    const bad = await loginWithPassword({
      store,
      hasher: hasherFor("hash-ok"),
      email: "joe@example.com",
      password: "wrong-password",
      now: NOW,
      ip: "10.0.0.8",
      userAgent: "test",
    });
    assert.deepEqual(bad, { ok: false, error: "invalid" });
    assert.equal(store.sessions.length, 1);
    assert.equal(store.audits.at(-1)?.action, "login_failed");
  });

  it("stops at five attempts in the window and writes a rate-limit event", async () => {
    const store = memoryStore([verified]);
    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      await loginWithPassword({
        store,
        hasher: hasherFor("hash-ok"),
        email: "joe@example.com",
        password: "wrong-password",
        now: NOW,
        ip: "10.0.0.8",
        userAgent: "test",
      });
    }

    const blocked = await loginWithPassword({
      store,
      hasher: hasherFor("hash-ok"),
      email: "joe@example.com",
      password: "correct-password",
      now: NOW,
      ip: "10.0.0.9",
      userAgent: "test",
    });
    assert.deepEqual(blocked, { ok: false, error: "rate_limited" });
    assert.equal(store.sessions.length, 0);
    assert.equal(store.audits.at(-1)?.action, "login_rate_limited");
  });

  it("does not create a session when an authenticator is confirmed", async () => {
    const store = memoryStore([verified], new Set(["id1"]));
    const result = await loginWithPassword({
      store,
      hasher: hasherFor("hash-ok"),
      email: "joe@example.com",
      password: "correct-password",
      now: NOW,
      ip: "10.0.0.8",
      userAgent: "test",
    });
    assert.deepEqual(result, { ok: true, mfaRequired: true, identityId: "id1" });
    assert.equal(store.sessions.length, 0);
    assert.equal(store.audits.at(-1)?.action, "login_mfa_required");
  });
});

function hasherFor(encoded: string) {
  return {
    async hash(plain: string) {
      return plain;
    },
    async verify(stored: string, plain: string) {
      return stored === encoded && plain === "correct-password";
    },
  };
}

function memoryStore(seed: IdentityRecord[], mfa: Set<string> = new Set()): AuthStore & {
  sessions: Array<{ identityId: string }>;
  audits: Array<{ action: string; identityId: string | null }>;
} {
  const identities = new Map(seed.map((identity) => [identity.email, identity]));
  const attempts: Array<{ key: string; at: Date }> = [];
  const sessions: Array<{ identityId: string }> = [];
  const audits: Array<{ action: string; identityId: string | null }> = [];
  return {
    sessions,
    audits,
    async hasConfirmedMfa(identityId) {
      return mfa.has(identityId);
    },
    async countAttempts(key, since) {
      return attempts.filter((item) => item.key === key && item.at >= since).length;
    },
    async recordAttempt(key, at) {
      attempts.push({ key, at });
    },
    async findIdentityByEmail(email) {
      return identities.get(email) ?? null;
    },
    async createSession(input) {
      sessions.push({ identityId: input.identityId });
    },
    async findSessionBySecretHash() {
      return null;
    },
    async touchSession() {},
    async revokeSession() {},
    async saveEmailToken() {},
    async findEmailToken() {
      return null;
    },
    async consumeEmailToken() {
      return false;
    },
    async setPasswordAndRevokeSessions() {},
    async markEmailVerified() {},
    async audit(event) {
      audits.push({ action: event.action, identityId: event.identityId });
    },
  };
}
