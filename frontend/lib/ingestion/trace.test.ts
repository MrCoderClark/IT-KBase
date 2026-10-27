import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyTrace, formatDuration, recordStage } from "./trace";

describe("recordStage", () => {
  it("replaces a stage and sums the total", () => {
    let trace = emptyTrace();
    trace = recordStage(trace, "parsing", 120, "file.docx");
    trace = recordStage(trace, "extracting", 9000, "title");
    assert.equal(trace.stages.length, 2);
    assert.equal(trace.totalMs, 9120);
    trace = recordStage(trace, "parsing", 80, "file.docx");
    assert.equal(trace.stages.length, 2);
    assert.equal(trace.totalMs, 9080);
  });
});

describe("formatDuration", () => {
  it("uses ms under one second and seconds after", () => {
    assert.equal(formatDuration(420), "420 ms");
    assert.equal(formatDuration(1500), "1.5 s");
    assert.equal(formatDuration(12500), "13 s");
  });
});
