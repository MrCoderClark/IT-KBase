/**
 * Pure helpers for sidebar page-tree drag-and-drop.
 * Drop targets map to `moveArticle(id, parentId, order)`.
 */

export type TreeDragNode = {
  id: string;
  parentId: string | null;
  order: number;
  children: TreeDragNode[];
};

export type DropPlace = "before" | "after" | "inside";

/** Synthetic targets for promoting a node to the root list. */
export const ROOT_DROP_START = "__root-start__";
export const ROOT_DROP_END = "__root-end__";

export function containsNode(root: TreeDragNode | null, id: string): boolean {
  if (!root) return false;
  if (root.id === id) return true;
  return root.children.some((child) => containsNode(child, id));
}

export function locateNode(
  nodes: TreeDragNode[],
  id: string,
  parent: TreeDragNode | null = null,
): { parent: TreeDragNode | null; siblings: TreeDragNode[] } | null {
  for (const node of nodes) {
    if (node.id === id) return { parent, siblings: nodes };
    const found = locateNode(node.children, id, node);
    if (found) return found;
  }
  return null;
}

/**
 * Resolve a drop onto a node (or a synthetic root zone) into parent + sibling index.
 */
export function dropDestination(
  nodes: TreeDragNode[],
  draggedId: string,
  targetId: string,
  place: DropPlace,
): { parentId: string | null; order: number } | null {
  if (targetId === ROOT_DROP_START) {
    return { parentId: null, order: 0 };
  }
  if (targetId === ROOT_DROP_END) {
    const rootCount = nodes.filter((node) => node.id !== draggedId).length;
    return { parentId: null, order: rootCount };
  }

  const dragged = locateNode(nodes, draggedId);
  if (!dragged) return null;
  const draggedNode = dragged.siblings.find((node) => node.id === draggedId) ?? null;

  if (place === "inside") {
    if (draggedId === targetId || containsNode(draggedNode, targetId)) return null;
    const target = locateNode(nodes, targetId);
    const targetNode = target?.siblings.find((node) => node.id === targetId);
    const childCount = (targetNode?.children ?? []).filter((child) => child.id !== draggedId).length;
    return { parentId: targetId, order: childCount };
  }

  const target = locateNode(nodes, targetId);
  if (!target) return null;
  const parentId = target.parent?.id ?? null;
  if (parentId && containsNode(draggedNode, parentId)) return null;
  const siblings = target.siblings.filter((node) => node.id !== draggedId);
  const index = siblings.findIndex((node) => node.id === targetId);
  if (index < 0) return null;
  return { parentId, order: place === "before" ? index : index + 1 };
}

/** Optimistic client tree update after a successful drop mapping. */
export function applyTreeMove<T extends TreeDragNode>(
  nodes: T[],
  id: string,
  parentId: string | null,
  index: number,
): T[] {
  let moved: T | null = null;
  const remove = (list: T[]): T[] => {
    const next: T[] = [];
    for (const node of list) {
      if (node.id === id) {
        moved = { ...node, children: node.children as T["children"] };
        continue;
      }
      next.push({ ...node, children: remove(node.children as T[]) as T["children"] });
    }
    return next;
  };
  const stripped = remove(nodes);
  if (!moved) return nodes;
  const placed = { ...moved, parentId } as T;

  const insert = (list: T[], pid: string | null): T[] => {
    if (pid === null) {
      const copy = list.slice();
      copy.splice(Math.min(index, copy.length), 0, placed);
      return copy.map((node, order) => ({ ...node, order }));
    }
    return list.map((node) => {
      if (node.id !== pid) {
        return { ...node, children: insert(node.children as T[], pid) as T["children"] };
      }
      const children = (node.children as T[]).slice();
      children.splice(Math.min(index, children.length), 0, placed);
      return {
        ...node,
        children: children.map((child, order) => ({ ...child, order })) as T["children"],
      };
    });
  };
  return insert(stripped, parentId);
}
