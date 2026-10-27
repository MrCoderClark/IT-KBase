"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { X } from "lucide-react";

export const KbCodeBlock = Node.create({
  name: "kbCodeBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      code: { default: "" },
      language: { default: "powershell" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="kb-code-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "kb-code-block" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(KbCodeBlockView);
  },
});

function KbCodeBlockView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const code = String(node.attrs.code ?? "");
  const language = String(node.attrs.language ?? "powershell");
  return (
    <NodeViewWrapper
      className="group relative overflow-hidden rounded-md"
      style={{ backgroundColor: "#0B1220" }}
    >
      <input
        value={language}
        onChange={(event) => updateAttributes({ language: event.target.value })}
        aria-label="Code language"
        className="absolute top-2.5 left-4 w-28 border-0 bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-white/40 outline-none placeholder:text-white/20"
        placeholder="language"
      />
      {editor.isEditable ? (
        <button
          type="button"
          onClick={deleteNode}
          className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-sm text-white/40 hover:bg-white/[0.08] hover:text-white/80"
          aria-label="Remove code block"
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
      <textarea
        value={code}
        onChange={(event) => updateAttributes({ code: event.target.value })}
        rows={Math.max(3, code.split("\n").length)}
        aria-label="Command"
        spellCheck={false}
        className="w-full resize-y border-0 bg-transparent p-4 pt-9 font-mono text-[13.5px] leading-[22px] font-medium text-[#E6EDF7] outline-none placeholder:text-white/25"
        placeholder="ipconfig /flushdns"
      />
    </NodeViewWrapper>
  );
}
