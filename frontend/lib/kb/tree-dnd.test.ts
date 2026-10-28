import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ROOT_DROP_END,
  ROOT_DROP_START,
  applyTreeMove,
  dropDestination,
  type TreeDragNode,
} from "./tree-dnd";

function node(
  id: string,
  children: TreeDragNode[] = [],
  parentId: string | null = null,
): TreeDragNode {
  return {
    id,
    parentId,
    order: 0,
    children: children.map((child, order) => ({
      ...child,
      parentId: id,
      order,
    })),
  };
}

describe("dropDestination", () => {
  const tree = [
    node("a", [node("a1"), node("a2")]),
    node("b"),
    node("c"),
  ];

  it("reorders siblings before / after", () => {
    assert.deepEqual(dropDestination(tree, "c", "a", "before"), {
      parentId: null,
      order: 0,
    });
    assert.deepEqual(dropDestination(tree, "a", "c", "after"), {
      parentId: null,
      order: 2,
    });
    assert.deepEqual(dropDestination(tree, "a2", "a1", "before"), {
      parentId: "a",
      order: 0,
    });
  });

  it("nests inside a target as the last child", () => {
    assert.deepEqual(dropDestination(tree, "b", "a", "inside"), {
      parentId: "a",
      order: 2,
    });
  });

  it("promotes to root via synthetic zones", () => {
    assert.deepEqual(dropDestination(tree, "a1", ROOT_DROP_START, "before"), {
      parentId: null,
      order: 0,
    });
    assert.deepEqual(dropDestination(tree, "a1", ROOT_DROP_END, "after"), {
      parentId: null,
      order: 3,
    });
  });

  it("blocks dropping a node under its descendant", () => {
    assert.equal(dropDestination(tree, "a", "a1", "inside"), null);
  });
});

describe("applyTreeMove", () => {
  it("moves a child to the root list", () => {
    const tree = [node("a", [node("a1"), node("a2")]), node("b")];
    const next = applyTreeMove(tree, "a1", null, 0);
    assert.equal(next[0]?.id, "a1");
    assert.equal(next[0]?.parentId, null);
    assert.equal(next[1]?.id, "a");
    assert.deepEqual(
      next[1]?.children.map((child) => child.id),
      ["a2"],
    );
  });
});
