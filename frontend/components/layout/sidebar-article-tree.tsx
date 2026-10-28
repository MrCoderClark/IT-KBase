"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ChevronRight, FileText, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { moveArticle } from "@/lib/actions/move-article";
import {
  ROOT_DROP_END,
  ROOT_DROP_START,
  applyTreeMove,
  dropDestination,
  type DropPlace,
} from "@/lib/kb/tree-dnd";
import type { ArticleTreeNode } from "@/lib/queries/article-tree";

const STORAGE_KEY = "techbase:tree-expanded";

type DropTarget = {
  id: string;
  place: DropPlace;
};

/**
 * Collapsible article tree. Reviewers drag the grip to reorder, nest, or
 * promote a page back to the top level (root drop strips).
 */
export function SidebarArticleTree({
  tree,
  canMove = false,
}: {
  tree: ArticleTreeNode[];
  canMove?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [nodes, setNodes] = useState(tree);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    setNodes(tree);
  }, [tree]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setExpanded(new Set(JSON.parse(stored) as string[]));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]));
    } catch {
      // ignore
    }
  }, [expanded, hydrated]);

  useEffect(() => {
    if (!pathname.startsWith("/kb/") || nodes.length === 0) return;
    const slug = pathname.split("/")[2];
    if (!slug) return;
    const ancestorIds = findAncestors(nodes, slug);
    if (!ancestorIds?.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of ancestorIds) next.add(id);
      return next;
    });
  }, [pathname, nodes]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onDrop = useCallback(
    async (targetId: string, place: DropPlace) => {
      const draggedId = draggingId;
      setDraggingId(null);
      setDrop(null);
      if (!canMove || !draggedId) return;
      if (
        draggedId === targetId &&
        targetId !== ROOT_DROP_START &&
        targetId !== ROOT_DROP_END
      ) {
        return;
      }

      const destination = dropDestination(nodes, draggedId, targetId, place);
      if (!destination) return;

      const previous = nodes;
      setMoveError(null);
      setNodes(applyTreeMove(nodes, draggedId, destination.parentId, destination.order));
      if (place === "inside" && targetId !== ROOT_DROP_START && targetId !== ROOT_DROP_END) {
        setExpanded((prev) => new Set(prev).add(targetId));
      }

      const result = await moveArticle(draggedId, destination.parentId, destination.order);
      if (!result.success) {
        setNodes(previous);
        setMoveError(result.error);
        return;
      }
      router.refresh();
    },
    [canMove, draggingId, nodes, router],
  );

  if (nodes.length === 0) return null;

  const showRootZones = Boolean(canMove && draggingId);

  return (
    <div>
      <ul className="flex flex-col gap-0.5">
        {showRootZones ? (
          <li>
            <RootDropZone
              label="Move to top of library"
              active={drop?.id === ROOT_DROP_START}
              onHover={() => setDrop({ id: ROOT_DROP_START, place: "before" })}
              onLeave={() => setDrop((current) => (current?.id === ROOT_DROP_START ? null : current))}
              onDrop={() => onDrop(ROOT_DROP_START, "before")}
            />
          </li>
        ) : null}
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            pathname={pathname}
            expanded={expanded}
            canMove={canMove}
            draggingId={draggingId}
            drop={drop}
            onToggle={toggle}
            onDragStart={setDraggingId}
            onDragEnd={() => {
              setDraggingId(null);
              setDrop(null);
            }}
            onDragHover={setDrop}
            onDrop={onDrop}
          />
        ))}
        {showRootZones ? (
          <li>
            <RootDropZone
              label="Move to end of library"
              active={drop?.id === ROOT_DROP_END}
              onHover={() => setDrop({ id: ROOT_DROP_END, place: "after" })}
              onLeave={() => setDrop((current) => (current?.id === ROOT_DROP_END ? null : current))}
              onDrop={() => onDrop(ROOT_DROP_END, "after")}
            />
          </li>
        ) : null}
      </ul>
      {moveError ? (
        <p className="px-2 py-1 text-[11px] leading-4 text-amber-300">{moveError}</p>
      ) : null}
    </div>
  );
}

function RootDropZone({
  label,
  active,
  onHover,
  onLeave,
  onDrop,
}: {
  label: string;
  active: boolean;
  onHover: () => void;
  onLeave: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={label}
      className={cn(
        "mx-1 my-0.5 rounded-sm border border-dashed px-2 py-1.5 text-center text-[11px] leading-4 transition-colors",
        active
          ? "border-[#93B4FF] bg-white/10 text-white"
          : "border-white/15 text-sidebar-fg/50",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onHover();
      }}
      onDragLeave={onLeave}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
    >
      {label}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  pathname,
  expanded,
  canMove,
  draggingId,
  drop,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragHover,
  onDrop,
}: {
  node: ArticleTreeNode;
  depth: number;
  pathname: string;
  expanded: Set<string>;
  canMove: boolean;
  draggingId: string | null;
  drop: DropTarget | null;
  onToggle: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragHover: (target: DropTarget | null) => void;
  onDrop: (targetId: string, place: DropPlace) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isActive = pathname === `/kb/${node.slug}`;
  const isDraft = node.status === "draft";
  const isInReview = node.status === "in_review";
  const indent = Math.min(depth, 5) * 12;
  const isDrop = drop?.id === node.id;

  return (
    <li>
      {isDrop && drop.place === "before" ? <DropLine indent={indent} /> : null}
      <div
        className={cn(
          "group relative flex h-8 items-center rounded-sm text-[13px] leading-5 transition-colors",
          isActive
            ? "bg-sidebar-active text-white"
            : "text-sidebar-fg/90 hover:bg-white/[0.04] hover:text-white",
          isDrop && drop.place === "inside" && "bg-white/10 ring-1 ring-white/40",
        )}
        style={{ paddingLeft: `${8 + indent}px` }}
        onDragOver={
          canMove
            ? (event) => {
                if (!draggingId || draggingId === node.id) return;
                event.preventDefault();
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                const ratio = (event.clientY - rect.top) / rect.height;
                // Wider before/after bands so sibling reorder is easier to hit.
                const place: DropPlace =
                  ratio < 0.35 ? "before" : ratio > 0.65 ? "after" : "inside";
                onDragHover({ id: node.id, place });
              }
            : undefined
        }
        onDrop={
          canMove
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (drop?.id === node.id) onDrop(node.id, drop.place);
              }
            : undefined
        }
      >
        {canMove ? (
          <button
            type="button"
            draggable
            aria-label={`Move ${node.title}`}
            className="flex size-4 shrink-0 cursor-grab items-center justify-center text-sidebar-fg/40 hover:text-white active:cursor-grabbing"
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", node.id);
              event.dataTransfer.effectAllowed = "move";
              onDragStart(node.id);
            }}
            onDragEnd={onDragEnd}
          >
            <GripVertical size={12} aria-hidden />
          </button>
        ) : null}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-white/10"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              size={14}
              className={cn("transition-transform duration-150", isExpanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center">
            <FileText size={12} className="opacity-50" />
          </span>
        )}
        <Link
          href={`/kb/${node.slug}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2"
        >
          <span className="truncate">{node.title}</span>
          {isDraft ? (
            <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
              Draft
            </span>
          ) : null}
          {isInReview ? (
            <span className="shrink-0 rounded bg-blue-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase text-blue-300">
              Review
            </span>
          ) : null}
        </Link>
      </div>
      {isDrop && drop.place === "after" ? <DropLine indent={indent} /> : null}
      {hasChildren && isExpanded ? (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              expanded={expanded}
              canMove={canMove}
              draggingId={draggingId}
              drop={drop}
              onToggle={onToggle}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragHover={onDragHover}
              onDrop={onDrop}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function DropLine({ indent }: { indent: number }) {
  return (
    <div
      className="h-0.5 rounded-full bg-[#93B4FF]"
      style={{ marginLeft: `${16 + indent}px` }}
      aria-hidden
    />
  );
}

function findAncestors(nodes: ArticleTreeNode[], slug: string, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.slug === slug) return ancestors;
    if (node.children.length > 0) {
      const found = findAncestors(node.children, slug, [...ancestors, node.id]);
      if (found) return found;
    }
  }
  return null;
}
