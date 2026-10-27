"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { X } from "lucide-react";
import { ProseField } from "@/components/kb/editor/prose-field";
import { StepBadge } from "@/components/kb/step-badge";

export const KbStep = Node.create({
  name: "kbStep",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: "" },
      body: { default: "" },
      code: { default: "" },
      language: { default: "powershell" },
      images: { default: [] },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="kb-step"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "kb-step" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(KbStepView);
  },
});

function KbStepView({ node, updateAttributes, deleteNode, getPos, editor }: NodeViewProps) {
  const title = String(node.attrs.title ?? "");
  const body = String(node.attrs.body ?? "");
  const code = String(node.attrs.code ?? "");
  const language = String(node.attrs.language ?? "powershell");
  const images = Array.isArray(node.attrs.images)
    ? (node.attrs.images as string[])
    : [];
  const pos = typeof getPos === "function" ? getPos() : null;
  const number = stepNumber(editor.state.doc, pos ?? null);

  return (
    <NodeViewWrapper className="flex gap-4 py-1">
      <StepBadge number={number} className="mt-1" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <input
            value={title}
            onChange={(event) => updateAttributes({ title: event.target.value })}
            placeholder="Step title"
            aria-label={`Step ${number} title`}
            className="min-w-0 flex-1 border-0 bg-transparent text-[16px] leading-6 font-semibold text-fg outline-none placeholder:text-fg-subtle/50"
          />
          {editor.isEditable ? (
            <button
              type="button"
              onClick={deleteNode}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg"
              aria-label={`Remove step ${number}`}
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>
        <ProseField
          value={body}
          onChange={(next) => updateAttributes({ body: next })}
          placeholder="What to do."
          ariaLabel={`Step ${number} body`}
          minHeight="4.5rem"
        />
        {images.length > 0 ? (
          <div className="flex flex-col gap-2">
            {images.map((src, index) => (
              // Imported screenshot from the Word document.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${number}-${index}`}
                src={src}
                alt="Screenshot from the Word document"
                className="max-h-64 rounded-lg border border-border"
              />
            ))}
          </div>
        ) : null}
        <div
          className="relative overflow-hidden rounded-md"
          style={{ backgroundColor: "#0B1220" }}
        >
          <input
            value={language}
            onChange={(event) => updateAttributes({ language: event.target.value })}
            aria-label={`Step ${number} language`}
            className="absolute top-2.5 left-4 w-28 border-0 bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-white/40 outline-none"
            placeholder="language"
          />
          <textarea
            value={code}
            onChange={(event) => updateAttributes({ code: event.target.value })}
            rows={Math.max(2, code.split("\n").length)}
            aria-label={`Step ${number} command`}
            spellCheck={false}
            className="w-full resize-y border-0 bg-transparent p-4 pt-9 font-mono text-[13.5px] leading-[22px] font-medium text-[#E6EDF7] outline-none placeholder:text-white/25"
            placeholder="Optional command"
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

function stepNumber(doc: { descendants: (f: (node: { type: { name: string } }, pos: number) => boolean | void) => void }, pos: number | null): number {
  if (pos == null) return 1;
  let count = 0;
  doc.descendants((node, nodePos) => {
    if (node.type.name !== "kbStep") return;
    if (nodePos > pos) return false;
    count += 1;
  });
  return Math.max(count, 1);
}
