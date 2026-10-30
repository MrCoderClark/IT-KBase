import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { originMismatch } from "./request-origin";

function req(init: { method?: string; origin?: string | null; host?: string }) {
  const headers = new Headers();
  if (init.host) headers.set("host", init.host);
  if (init.origin) headers.set("origin", init.origin);
  if (init.origin === null) {
    /* omit */
  }
  return new Request("http://127.0.0.1:3000/api/upload/presign", {
    method: init.method ?? "POST",
    headers,
  });
}

describe("originMismatch", () => {
  it("allows GET without Origin", () => {
    assert.equal(originMismatch(req({ method: "GET", host: "127.0.0.1:3000" })), null);
  });

  it("allows same-origin POST", () => {
    assert.equal(
      originMismatch(
        req({
          method: "POST",
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
        }),
      ),
      null,
    );
  });

  it("blocks cross-origin POST", () => {
    assert.match(
      originMismatch(
        req({
          method: "POST",
          host: "127.0.0.1:3000",
          origin: "https://evil.example",
        }),
      ) ?? "",
      /Cross-origin/,
    );
  });

  it("blocks POST with no Origin", () => {
    assert.match(
      originMismatch(req({ method: "POST", host: "app.techbase.local", origin: null })) ?? "",
      /Origin/,
    );
  });
});
