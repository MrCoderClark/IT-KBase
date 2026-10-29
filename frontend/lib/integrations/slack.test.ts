import assert from "node:assert/strict";
import { describe, it } from "node:test";

function isSlackWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

describe("Slack webhook URL", () => {
  it("accepts hooks.slack.com https URLs", () => {
    assert.equal(
      isSlackWebhookUrl("https://hooks.slack.com/services/T00/B00/xxx"),
      true,
    );
  });

  it("rejects non-Slack hosts and http", () => {
    assert.equal(isSlackWebhookUrl("https://example.com/hooks"), false);
    assert.equal(isSlackWebhookUrl("http://hooks.slack.com/services/T00/B00/xxx"), false);
    assert.equal(isSlackWebhookUrl("not-a-url"), false);
  });
});
