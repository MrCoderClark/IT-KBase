import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockProseText, chunkVersion, estimateTokens, type ChunkSection } from "./chunker";

describe("blockProseText", () => {
  it("reads a string, strips HTML, and collapses whitespace", () => {
    assert.equal(blockProseText("<p>Run   the <b>wizard</b></p>", null), "Run the wizard");
  });

  it("joins a title and body from an object", () => {
    assert.equal(blockProseText({ title: "Step 1", body: "Open Settings" }, null), "Step 1 Open Settings");
  });

  it("joins string array elements and ignores objects", () => {
    assert.equal(blockProseText(["First", { x: 1 }, "Third"], null), "First Third");
  });

  it("appends image alt text and treats null content as empty", () => {
    assert.equal(blockProseText(null, "Network share dialog"), "Network share dialog");
  });
});

describe("estimateTokens", () => {
  it("is at least 1 and scales with length", () => {
    assert.equal(estimateTokens(""), 1);
    assert.ok(estimateTokens("a".repeat(400)) >= 100);
  });
});

describe("chunkVersion", () => {
  const sections: ChunkSection[] = [
    {
      id: "sec-overview",
      kind: "overview",
      title: "Overview",
      order: 0,
      blocks: [{ id: "b1", order: 0, content: "<p>This fixes 0x80180014.</p>", code: null, imageAlt: null }],
    },
    {
      id: "sec-steps",
      kind: "steps",
      title: "Step-by-step",
      order: 1,
      blocks: [
        { id: "b2", order: 0, content: { title: "Remove the record", body: "In Intune" }, code: null, imageAlt: null },
        { id: "b3", order: 1, content: null, code: "Get-WindowsAutopilotInfo -Online\r\n", imageAlt: null },
      ],
    },
  ];

  it("emits one prose chunk per section with prose and one code chunk per command", () => {
    const chunks = chunkVersion(sections);
    assert.equal(chunks.length, 3);

    const overview = chunks[0];
    assert.equal(overview.kind, "prose");
    assert.equal(overview.sectionKind, "overview");
    assert.equal(overview.blockId, null);
    assert.equal(overview.text, "This fixes 0x80180014.");

    const stepsProse = chunks[1];
    assert.equal(stepsProse.kind, "prose");
    assert.equal(stepsProse.text, "Remove the record In Intune");

    const code = chunks[2];
    assert.equal(code.kind, "code");
    assert.equal(code.blockId, "b3");
    assert.equal(code.sectionKind, "steps");
    // Kept verbatim (CRLF normalised, trailing newline trimmed) so it can be quoted.
    assert.equal(code.text, "Get-WindowsAutopilotInfo -Online");
  });

  it("numbers chunks across the whole version in reading order", () => {
    const ords = chunkVersion(sections).map((chunk) => chunk.ord);
    assert.deepEqual(ords, [0, 1, 2]);
  });

  it("skips a section that has no prose but still emits its code", () => {
    const codeOnly: ChunkSection[] = [
      {
        id: "sec",
        kind: "steps",
        title: "Commands",
        order: 0,
        blocks: [{ id: "b", order: 0, content: null, code: "net user Administrator /active:yes", imageAlt: null }],
      },
    ];
    const chunks = chunkVersion(codeOnly);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].kind, "code");
  });

  it("respects block and section order regardless of input order", () => {
    const shuffled: ChunkSection[] = [
      {
        id: "s2",
        kind: "verification",
        title: "Verify",
        order: 1,
        blocks: [{ id: "x", order: 0, content: "Second section", code: null, imageAlt: null }],
      },
      {
        id: "s1",
        kind: "overview",
        title: "Overview",
        order: 0,
        blocks: [{ id: "y", order: 0, content: "First section", code: null, imageAlt: null }],
      },
    ];
    const texts = chunkVersion(shuffled).map((chunk) => chunk.text);
    assert.deepEqual(texts, ["First section", "Second section"]);
  });
});
