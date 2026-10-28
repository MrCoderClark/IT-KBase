import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildContentSecurityPolicy, SECURITY_HEADERS } from "./headers";
import { THEME_INIT_SCRIPT_SHA256 } from "./theme-init-script";

describe("security headers", () => {
  it("lists the fixed headers from the security spec", () => {
    const keys = SECURITY_HEADERS.map((row) => row.key);
    assert.deepEqual(keys, [
      "Strict-Transport-Security",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ]);
    assert.match(
      SECURITY_HEADERS.find((row) => row.key === "Strict-Transport-Security")!.value,
      /max-age=31536000/,
    );
  });

  it("builds a nonce CSP with strict-dynamic and the theme script hash", () => {
    const csp = buildContentSecurityPolicy("abc123", false);
    assert.match(csp, /nonce-abc123/);
    assert.match(csp, /strict-dynamic/);
    assert.ok(csp.includes(THEME_INIT_SCRIPT_SHA256));
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
    assert.match(csp, /img-src 'self' https: data: blob:/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.match(csp, /upgrade-insecure-requests/);
  });

  it("allows unsafe-eval only in development", () => {
    const csp = buildContentSecurityPolicy("devnonce", true);
    assert.match(csp, /unsafe-eval/);
    assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  });
});
