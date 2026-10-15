import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passkeyName, signatureCounterRegressed } from "./passkey";

describe("passkey counter", () => {
  it("accepts a synced passkey that stays at 0", () => {
    assert.equal(signatureCounterRegressed(0, 0), false);
  });

  it("accepts the first use that leaves 0", () => {
    assert.equal(signatureCounterRegressed(0, 1), false);
  });

  it("rejects a counter that does not move forward", () => {
    assert.equal(signatureCounterRegressed(4, 4), true);
    assert.equal(signatureCounterRegressed(4, 3), true);
    assert.equal(signatureCounterRegressed(4, 0), true);
  });
});

describe("passkey name", () => {
  it("uses a default when the name is blank", () => {
    assert.equal(passkeyName("   "), "This device");
  });

  it("keeps a short name and drops control characters", () => {
    assert.equal(passkeyName("This PC"), "This PC");
    assert.equal(passkeyName("Desk\nkey"), "Deskkey");
    assert.equal(passkeyName("x".repeat(50)).length, 40);
  });
});
