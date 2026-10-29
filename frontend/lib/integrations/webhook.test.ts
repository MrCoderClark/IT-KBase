import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedWebhookUrl } from "./webhook";

describe("isAllowedWebhookUrl", () => {
  it("accepts Slack https hosts when restricted", () => {
    assert.equal(
      isAllowedWebhookUrl("https://hooks.slack.com/services/T00/B00/xxx", ["hooks.slack.com"]),
      true,
    );
  });

  it("rejects wrong hosts, http, and garbage when restricted", () => {
    assert.equal(isAllowedWebhookUrl("https://example.com/hooks", ["hooks.slack.com"]), false);
    assert.equal(isAllowedWebhookUrl("http://hooks.slack.com/services/x", ["hooks.slack.com"]), false);
    assert.equal(isAllowedWebhookUrl("not-a-url", ["hooks.slack.com"]), false);
  });

  it("allows any https host when unrestricted", () => {
    assert.equal(isAllowedWebhookUrl("https://hooks.example.com/path", null), true);
    assert.equal(isAllowedWebhookUrl("http://hooks.example.com/path", null), false);
  });
});
