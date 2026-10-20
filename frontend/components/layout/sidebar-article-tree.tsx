"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleTreeNode } from "@/lib/queries/article-tree";

const STORAGE_KEY = "techbase:tree-expanded";

/**
 * Collapsible article tree. The layout owns the data, so moving between
 * articles does not refetch or remount this list.
 */
export function SidebarArticleTree({ tree }: { tree: ArticleTreeNode[] }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Load expansion state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        setExpanded(new Set(ids));
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist expansion state
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]));
    } catch {
      // ignore
    }
  }, [expanded, hydrated]);

  // Auto-expand ancestors of the current article
  useEffect(() => {
    if (!pathname.startsWith("/kb/") || tree.length === 0) return;
    const slug = pathname.split("/")[2];
    if (!slug) return;

    const findNodeAndAncestors = (
      nodes: ArticleTreeNode[],
      ancestors: string[] = []
    ): string[] | null => {
      for (const node of nodes) {
        if (node.slug === slug) {
          return ancestors;
        }
        if (node.children.length > 0) {
          const result = findNodeAndAncestors(node.children, [...ancestors, node.id]);
          if (result) return result;
        }
      }
      return null;
    };

    const ancestorIds = findNodeAndAncestors(tree);
    if (ancestorIds && ancestorIds.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const id of ancestorIds) {
          next.add(id);
        }
        return next;
      });
    }
  }, [pathname, tree]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (tree.length === 0) return null;

  return (
    <ul className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          pathname={pathname}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}

function TreeNode({
  node,
  depth,
  pathname,
  expanded,
  onToggle,
}: {
  node: ArticleTreeNode;
  depth: number;
  pathname: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isActive = pathname === `/kb/${node.slug}`;
  const isDraft = node.status === "draft";
  const isInReview = node.status === "in_review";

  // Indent based on depth, max out at depth 5
  const indent = Math.min(depth, 5) * 12;

  return (
    <li>
      <div
        className={cn(
          "group relative flex h-8 items-center rounded-sm text-[13px] leading-5 transition-colors",
          isActive
            ? "bg-sidebar-active text-white"
            : "text-sidebar-fg/90 hover:bg-white/[0.04] hover:text-white"
        )}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {/* Expand/collapse button */}
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
              className={cn(
                "transition-transform duration-150",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center">
            <FileText size={12} className="opacity-50" />
          </span>
        )}

        {/* Article link */}
        <Link
          href={`/kb/${node.slug}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2"
        >
          <span className="truncate">{node.title}</span>
          {isDraft && (
            <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
              Draft
            </span>
          )}
          {isInReview && (
            <span className="shrink-0 rounded bg-blue-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase text-blue-300">
              Review
            </span>
          )}
        </Link>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
