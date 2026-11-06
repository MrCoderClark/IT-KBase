import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keywords, matchTroubleshooting, stripHtml, type TroubleItem } from "./troubleshooting";

describe("stripHtml", () => {
  it("drops tags and entities, collapses whitespace", () => {
    assert.equal(stripHtml("<p>Boot&nbsp;into   <b>WinRE</b></p>"), "Boot into WinRE");
  });
});

describe("keywords", () => {
  it("keeps significant tokens and drops short/stop words", () => {
    const kw = keywords("Boot into the Windows Recovery Environment");
    assert.ok(kw.has("recovery"));
    assert.ok(kw.has("environment"));
    assert.ok(!kw.has("the")); // stopword
    assert.ok(!kw.has("into")); // stopword
    assert.ok(!kw.has("windows")); // domain stopword
  });
});

describe("matchTroubleshooting", () => {
  const items: TroubleItem[] = [
    { id: "t1", variant: "warning", title: "WinRE does not appear", content: "If the recovery environment will not open, use installation media." },
    { id: "t2", variant: "info", title: "Mailbox missing in OWA", content: "Check delegate permissions in Exchange." },
  ];

  it("ranks the callout that shares keywords with the step", () => {
    const matched = matchTroubleshooting(
      { stepNumber: 1, title: "Boot into Windows Recovery Environment", content: "" },
      items,
    );
    assert.equal(matched[0]?.id, "t1");
  });

  it("returns nothing when no keywords overlap", () => {
    const matched = matchTroubleshooting(
      { stepNumber: 9, title: "Configure a Cisco ASA firewall", content: "" },
      items,
    );
    assert.deepEqual(matched, []);
  });
});
