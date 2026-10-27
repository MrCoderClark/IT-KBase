"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { CircleCheck, X } from "lucide-react";

export const ChecklistItem = Node.create({
  name: "checklistItem",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      text: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="checklist-item"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "checklist-item" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChecklistItemView);
  },
});

function ChecklistItemView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const text = String(node.attrs.text ?? "");
  return (
    <NodeViewWrapper className="flex items-start gap-3 py-0.5">
      <CircleCheck size={20} className="mt-1.5 shrink-0 text-success" aria-hidden />
      <input
        value={text}
        onChange={(event) => updateAttributes({ text: event.target.value })}
        placeholder="Requirement"
        aria-label="Checklist item"
        className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[15px] leading-6 text-fg outline-none placeholder:text-fg-subtle/50"
      />
      {editor.isEditable ? (
        <button
          type="button"
          onClick={deleteNode}
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg"
          aria-label="Remove item"
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </NodeViewWrapper>
  );
}
