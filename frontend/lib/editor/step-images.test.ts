import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STEP_IMG_MARK, bodyWithoutImageMarks, stepImagePieces } from "./step-images";

describe("stepImagePieces", () => {
  it("interleaves images at markers", () => {
    const body = `Open Settings.${STEP_IMG_MARK}Figure 3 caption.${STEP_IMG_MARK}Select Connect.`;
    const pieces = stepImagePieces(body, ["data:image/png;base64,a", "data:image/png;base64,b"]);
    assert.deepEqual(pieces, [
      { type: "text", text: "Open Settings." },
      { type: "image", url: "data:image/png;base64,a" },
      { type: "text", text: "Figure 3 caption." },
      { type: "image", url: "data:image/png;base64,b" },
      { type: "text", text: "Select Connect." },
    ]);
  });

  it("appends leftover images after text for legacy steps", () => {
    const pieces = stepImagePieces("Do the thing.", ["data:image/png;base64,a", "data:image/png;base64,b"]);
    assert.deepEqual(pieces, [
      { type: "text", text: "Do the thing." },
      { type: "image", url: "data:image/png;base64,a" },
      { type: "image", url: "data:image/png;base64,b" },
    ]);
  });
});

describe("bodyWithoutImageMarks", () => {
  it("strips markers for the editor field", () => {
    assert.equal(
      bodyWithoutImageMarks(`Hello.${STEP_IMG_MARK}World.`),
      "Hello.\n\nWorld.",
    );
  });
});
