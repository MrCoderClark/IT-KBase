import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  passesPageGate,
  resolveEffectiveAccess,
  type PageAccessNode,
} from "./page-access";

function index(nodes: PageAccessNode[]): Map<string, PageAccessNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

describe("resolveEffectiveAccess", () => {
  const tree = index([
    {
      id: "a",
      parentId: null,
      title: "Root",
      accessMode: "inherit",
      accessRoleFloor: null,
    },
    {
      id: "b",
      parentId: "a",
      title: "Incident",
      accessMode: "role_floor",
      accessRoleFloor: "reviewer",
    },
    {
      id: "c",
      parentId: "b",
      title: "Child inherit",
      accessMode: "inherit",
      accessRoleFloor: null,
    },
    {
      id: "d",
      parentId: "b",
      title: "Child library",
      accessMode: "library",
      accessRoleFloor: null,
    },
  ]);

  it("inherits role_floor from the nearest explicit ancestor", () => {
    assert.deepEqual(resolveEffectiveAccess("c", tree), {
      mode: "role_floor",
      roleFloor: "reviewer",
      sourceArticleId: "b",
      sourceTitle: "Incident",
    });
  });

  it("honors an explicit library break", () => {
    assert.deepEqual(resolveEffectiveAccess("d", tree), {
      mode: "library",
      roleFloor: null,
      sourceArticleId: "d",
      sourceTitle: "Child library",
    });
  });

  it("defaults to library when the whole chain inherits", () => {
    assert.deepEqual(resolveEffectiveAccess("a", tree), {
      mode: "library",
      roleFloor: null,
      sourceArticleId: null,
      sourceTitle: null,
    });
  });
});

describe("passesPageGate", () => {
  const floor = {
    mode: "role_floor" as const,
    roleFloor: "reviewer" as const,
    sourceArticleId: "b",
    sourceTitle: "Incident",
  };

  it("lets admin through and enforces the floor for others", () => {
    assert.equal(passesPageGate("admin", floor), true);
    assert.equal(passesPageGate("reviewer", floor), true);
    assert.equal(passesPageGate("author", floor), false);
    assert.equal(passesPageGate("reader", floor), false);
  });

  it("passes everyone for library", () => {
    assert.equal(
      passesPageGate("reader", {
        mode: "library",
        roleFloor: null,
        sourceArticleId: null,
        sourceTitle: null,
      }),
      true,
    );
  });
});
