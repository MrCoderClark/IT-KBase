import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentWords, rerankBoost, rerankChunks, type Rerankable } from "./rerank";

function chunk(partial: Partial<Rerankable>): Rerankable {
  return { text: "", articleTitle: "", sectionTitle: "", score: 0.02, ...partial };
}

describe("contentWords", () => {
  it("lowercases, drops stopwords and short tokens, and dedupes", () => {
    assert.deepEqual(contentWords("How do I reset the VPN VPN tunnel?"), ["reset", "vpn", "tunnel"]);
  });

  it("is empty for a question of only stopwords", () => {
    assert.deepEqual(contentWords("how do I get it"), []);
  });
});

describe("rerankBoost", () => {
  it("is 1 when nothing matches", () => {
    assert.equal(rerankBoost({ text: "unrelated prose", title: "Other" }, [], ["vpn"]), 1);
  });

  it("rewards an exact-token hit most", () => {
    const withToken = rerankBoost({ text: "error 0x80180014 occurs", title: "" }, ["0x80180014"], []);
    const withTerm = rerankBoost({ text: "the vpn tunnel", title: "" }, [], ["vpn"]);
    assert.ok(withToken > withTerm);
  });

  it("matches tokens case-insensitively", () => {
    assert.equal(
      rerankBoost({ text: "run Get-WindowsAutopilotInfo now", title: "" }, ["get-windowsautopilotinfo"], []),
      1 + 0.6,
    );
  });
});

describe("rerankChunks", () => {
  it("promotes a lower-fused chunk that actually contains the exact token", () => {
    const tokens = ["0x80180014"];
    const chunks = [
      chunk({ text: "generic autopilot overview", articleTitle: "Autopilot", score: 0.03 }),
      chunk({ text: "fails with 0x80180014 during enrollment", articleTitle: "Autopilot", score: 0.02 }),
    ];
    const ranked = rerankChunks("Autopilot 0x80180014 enrollment", tokens, chunks);
    assert.ok(ranked[0].text.includes("0x80180014"));
  });

  it("is a stable no-op when no signal separates the chunks", () => {
    const chunks = [
      chunk({ text: "alpha", score: 0.03 }),
      chunk({ text: "beta", score: 0.02 }),
    ];
    const ranked = rerankChunks("", [], chunks);
    assert.deepEqual(ranked.map((c) => c.text), ["alpha", "beta"]);
  });

  it("keeps the fused order on a tie (stable sort)", () => {
    // Both chunks match "vpn" equally; the higher fused score must stay first.
    const chunks = [
      chunk({ text: "vpn a", score: 0.03 }),
      chunk({ text: "vpn b", score: 0.03 }),
    ];
    const ranked = rerankChunks("vpn", [], chunks);
    assert.deepEqual(ranked.map((c) => c.text), ["vpn a", "vpn b"]);
  });

  it("returns a single chunk untouched", () => {
    const only = [chunk({ text: "x" })];
    assert.equal(rerankChunks("anything", [], only), only);
  });
});
