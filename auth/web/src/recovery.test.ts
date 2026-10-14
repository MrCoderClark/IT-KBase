import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passwordProblem } from "./password-policy";
import { completePasswordReset, requestPasswordReset } from "./recovery";
import type { AuthStore, IdentityRecord } from "./types";

describe("password policy", () => {
  it("rejects short passwords and accepts a mixed one", () => {
    assert.equal(passwordProblem("short"), "Use at least 12 characters.");
    assert.equal(passwordProblem("TechBase-dev-1"), null);
  });
});

describe("password reset request", () => {
  it("accepts an unknown email without creating a token", async () => {
    const store = memoryStore();
    const result = await requestPasswordReset({
      store,
      email: "nobody@example.com",
      now: new Date("2026-10-14T12:00:00Z"),
      ip: "127.0.0.1",
      userAgent: "test",
    });
    assert.equal(result.status, "accepted");
    if (result.status === "accepted") assert.equal(result.mail, null);
    assert.equal(store.tokens.length, 0);
  });

  it("rejects a weak new password before consuming a token", async () => {
    const store = memoryStore();
    store.tokens.push({
      id: "t1",
      identityId: "id1",
      purpose: "reset_password",
      tokenHash: "unused",
      expiresAt: new Date("2026-10-14T13:00:00Z"),
      usedAt: null,
    });
    const result = await completePasswordReset({
      store,
      hasher: { hash: async (plain) => plain, verify: async () => false },
      token: "not-a-real-token",
      password: "short",
      now: new Date("2026-10-14T12:00:00Z"),
      ip: null,
      userAgent: null,
    });
    assert.deepEqual(result.ok, false);
    assert.equal(store.tokens[0]?.usedAt, null);
  });
});

function memoryStore(): AuthStore & {
  tokens: Array<{
    id: string;
    identityId: string;
    purpose: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  }>;
} {
  const identities = new Map<string, IdentityRecord>();
  const tokens: Array<{
    id: string;
    identityId: string;
    purpose: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  }> = [];
  const store: AuthStore & { tokens: typeof tokens } = {
    tokens,
    async countAttempts() {
      return 0;
    },
    async recordAttempt() {},
    async findIdentityByEmail(email) {
      return identities.get(email) ?? null;
    },
    async createSession() {},
    async findSessionBySecretHash() {
      return null;
    },
    async touchSession() {},
    async revokeSession() {},
    async saveEmailToken(input) {
      tokens.push({ id: `t${tokens.length}`, usedAt: null, ...input });
    },
    async findEmailToken(tokenHash) {
      return tokens.find((token) => token.tokenHash === tokenHash) ?? null;
    },
    async consumeEmailToken(id, at) {
      const token = tokens.find((item) => item.id === id && !item.usedAt);
      if (!token) return false;
      token.usedAt = at;
      return true;
    },
    async setPasswordAndRevokeSessions() {},
    async markEmailVerified() {},
    async audit() {},
  };
  return store;
}
