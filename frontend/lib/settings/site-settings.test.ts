import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAccent, parseEmailDomains, parseLogoUrl, parseRetentionDays } from "./site-settings";

describe("site settings", () => {
  it("accepts a 6-digit accent and rejects anything else", () => {
    assert.equal(parseAccent("#1e6bff"), "#1E6BFF");
    assert.equal(parseAccent("1E6BFF"), null);
    assert.equal(parseAccent("#fff"), null);
  });

  it("keeps version retention between 30 and 3650 days", () => {
    assert.equal(parseRetentionDays("365"), 365);
    assert.equal(parseRetentionDays("29"), null);
    assert.equal(parseRetentionDays("3651"), null);
  });

  it("accepts an http logo URL and a blank field", () => {
    assert.deepEqual(parseLogoUrl(""), { ok: true, logoUrl: null });
    assert.deepEqual(parseLogoUrl("https://cdn.example.com/logo.png"), {
      ok: true,
      logoUrl: "https://cdn.example.com/logo.png",
    });
    assert.deepEqual(parseLogoUrl("javascript:alert(1)"), { ok: false });
  });

  it("normalizes allowed email domains and rejects a bare name", () => {
    const parsed = parseEmailDomains("Contoso.com, fabrikam.com\ncontoso.com");
    assert.deepEqual(parsed, { ok: true, domains: ["contoso.com", "fabrikam.com"] });
    assert.deepEqual(parseEmailDomains("not a domain"), { ok: false });
  });
});
