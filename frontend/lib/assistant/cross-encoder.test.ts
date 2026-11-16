import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  applyLlmScores,
  CrossEncoderError,
  rerankViaLLM,
  type Scorable,
} from "./cross-encoder";

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_URL = process.env.INGESTION_URL;

function stubFetch(fn: FetchLike): void {
  (globalThis as unknown as { fetch: FetchLike }).fetch = fn;
}

function restoreFetch(): void {
  (globalThis as unknown as { fetch: typeof ORIGINAL_FETCH }).fetch = ORIGINAL_FETCH;
}

describe("applyLlmScores", () => {
  const score: Scorable & { tag: string } = { chunkId: "", score: 0, tag: "" };

  it("sorts by llm score desc, fused desc, then stable", () => {
    const candidates = [
      { ...score, chunkId: "a", score: 0.03, tag: "alpha" },
      { ...score, chunkId: "b", score: 0.04, tag: "beta" },
      { ...score, chunkId: "c", score: 0.02, tag: "gamma" },
    ];
    const ordered = applyLlmScores(candidates, { a: 0.9, b: 0.4, c: 0.4 });
    // a wins on LLM; b and c tie on LLM but b has the higher fused score.
    assert.deepEqual(
      ordered.map((c) => c.tag),
      ["alpha", "beta", "gamma"],
    );
  });

  it("puts unscored candidates after every scored one, in fused order", () => {
    const candidates = [
      { ...score, chunkId: "a", score: 0.04, tag: "alpha" },
      { ...score, chunkId: "b", score: 0.03, tag: "beta" },
      { ...score, chunkId: "c", score: 0.05, tag: "gamma" },
    ];
    // Only `a` and `c` are scored; `b` was skipped.
    const ordered = applyLlmScores(candidates, { a: 0.2, c: 0.9 });
    assert.deepEqual(
      ordered.map((c) => c.tag),
      ["gamma", "alpha", "beta"],
    );
  });

  it("is a no-op when scores are empty", () => {
    const candidates = [
      { ...score, chunkId: "a", score: 0.03 },
      { ...score, chunkId: "b", score: 0.04 },
    ];
    assert.equal(applyLlmScores(candidates, {}), candidates);
  });

  it("returns a single candidate untouched", () => {
    const only = [{ ...score, chunkId: "a", score: 0.03 }];
    assert.equal(applyLlmScores(only, { a: 1 }), only);
  });
});

describe("rerankViaLLM", () => {
  beforeEach(() => {
    process.env.INGESTION_URL = "http://127.0.0.1:8080";
  });
  afterEach(() => {
    restoreFetch();
    if (ORIGINAL_URL === undefined) delete process.env.INGESTION_URL;
    else process.env.INGESTION_URL = ORIGINAL_URL;
  });

  it("skips the network when fewer than two candidates", async () => {
    let called = false;
    stubFetch(async () => {
      called = true;
      return new Response("{}");
    });
    const result = await rerankViaLLM("q", [{ id: "a", title: "", text: "t" }], "ass");
    assert.deepEqual(result.scores, {});
    assert.equal(called, false);
  });

  it("posts to /assistant/rerank with the assertion and parses clamped scores", async () => {
    const seen: { url?: string; body?: unknown; auth?: string } = {};
    stubFetch(async (url, init) => {
      seen.url = url;
      seen.auth = (init.headers as Record<string, string>).Authorization;
      seen.body = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ scores: { a: 1.7, b: -0.4, c: 0.5 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const result = await rerankViaLLM(
      "Autopilot 0x80180014",
      [
        { id: "a", title: "A", text: "t1" },
        { id: "b", title: "B", text: "t2" },
        { id: "c", title: "C", text: "t3" },
      ],
      "ass-token",
    );
    assert.equal(seen.url, "http://127.0.0.1:8080/assistant/rerank");
    assert.equal(seen.auth, "Bearer ass-token");
    assert.equal((seen.body as { candidates: unknown[] }).candidates.length, 3);
    assert.deepEqual(result.scores, { a: 1, b: 0, c: 0.5 });
  });

  it("truncates the candidate list to the backend's max", async () => {
    let count = 0;
    stubFetch(async (_url, init) => {
      const body = JSON.parse(init.body as string) as { candidates: unknown[] };
      count = body.candidates.length;
      return new Response(JSON.stringify({ scores: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`,
      title: "t",
      text: "x",
    }));
    await rerankViaLLM("q", many, "ass");
    assert.equal(count, 24);
  });

  it("drops non-numeric scores", async () => {
    stubFetch(async () => {
      return new Response(
        JSON.stringify({ scores: { a: 0.5, b: "not a number", c: null } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const result = await rerankViaLLM(
      "q",
      [
        { id: "a", title: "", text: "t1" },
        { id: "b", title: "", text: "t2" },
        { id: "c", title: "", text: "t3" },
      ],
      "ass",
    );
    assert.deepEqual(result.scores, { a: 0.5 });
  });

  it("raises CrossEncoderError on a non-2xx response", async () => {
    stubFetch(async () => new Response("", { status: 502 }));
    await assert.rejects(
      rerankViaLLM(
        "q",
        [
          { id: "a", title: "", text: "t1" },
          { id: "b", title: "", text: "t2" },
        ],
        "ass",
      ),
      (err) => err instanceof CrossEncoderError && /HTTP 502/.test(err.message),
    );
  });

  it("raises CrossEncoderError when fetch throws (service down)", async () => {
    stubFetch(async () => {
      throw new Error("connection refused");
    });
    await assert.rejects(
      rerankViaLLM(
        "q",
        [
          { id: "a", title: "", text: "t1" },
          { id: "b", title: "", text: "t2" },
        ],
        "ass",
      ),
      (err) => err instanceof CrossEncoderError && /not running/.test(err.message),
    );
  });

  it("raises a dedicated message on timeout", async () => {
    stubFetch(async () => {
      const err = new Error("timed out");
      err.name = "TimeoutError";
      throw err;
    });
    await assert.rejects(
      rerankViaLLM(
        "q",
        [
          { id: "a", title: "", text: "t1" },
          { id: "b", title: "", text: "t2" },
        ],
        "ass",
      ),
      (err) => err instanceof CrossEncoderError && /timed out/.test(err.message),
    );
  });
});
