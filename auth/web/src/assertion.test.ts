import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mintAssertion, parseAssertionKeys, verifyAssertion } from "./assertion";

const KEYS = parseAssertionKeys("k1:test-assertion-key");
const NOW = new Date("2026-10-14T16:00:00Z");

describe("assertion", () => {
  it("round-trips a 60-second token and rejects a tampered one", () => {
    const token = mintAssertion({
      keys: KEYS,
      kid: "k1",
      identityId: "id1",
      userId: "user1",
      role: "author",
      sessionGen: 3,
      now: NOW,
    });
    const claims = verifyAssertion(token, KEYS, NOW);
    assert.equal(claims?.sub, "id1");
    assert.equal(claims?.uid, "user1");
    assert.equal(claims?.role, "author");
    assert.equal(claims?.gen, 3);
    assert.equal(claims?.aud, "ingestion");

    const broken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(verifyAssertion(broken, KEYS, NOW), null);
  });

  it("rejects an expired token", () => {
    const token = mintAssertion({
      keys: KEYS,
      kid: "k1",
      identityId: "id1",
      userId: "user1",
      role: "reader",
      sessionGen: 0,
      now: NOW,
    });
    const later = new Date(NOW.getTime() + 90_000);
    assert.equal(verifyAssertion(token, KEYS, later), null);
  });
});
