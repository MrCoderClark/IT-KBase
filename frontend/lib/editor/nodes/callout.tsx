"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { CALLOUT_VARIANTS, type EditorCallout } from "@/lib/editor/draft";
import type { CalloutVariant } from "@/lib/types/article";

const STYLES: Record<
  CalloutVariant,
  { bg: string; border: string; iconBg: string; iconColor: string; icon: typeof Info }
> = {
  info: {
    bg: "bg-info-soft",
    border: "border-info/40",
    iconBg: "bg-info/10",
    iconColor: "text-info",
    icon: Info,
  },
  important: {
    bg: "bg-accent-soft",
    border: "border-accent/40",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
    icon: CircleAlert,
  },
  warning: {
    bg: "bg-warning-soft",
    border: "border-warning/40",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    icon: TriangleAlert,
  },
  success: {
    bg: "bg-success-soft",
    border: "border-success/40",
    iconBg: "bg-success/10",
    iconColor: "text-success",
    icon: CircleCheck,
  },
};

const LABELS: Record<CalloutVariant, string> = {
  info: "Info",
  important: "Important",
  warning: "Warning",
  success: "Success",
};

export const KbCallout = Node.create({
  name: "kbCallout",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      variant: { default: "warning" },
      title: { default: "" },
      body: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="kb-callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "kb-callout" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(KbCalloutView);
  },
});

function KbCalloutView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const variant = (CALLOUT_VARIANTS.includes(node.attrs.variant)
    ? node.attrs.variant
    : "warning") as CalloutVariant;
  const title = String(node.attrs.title ?? "");
  const body = String(node.attrs.body ?? "");
  const style = STYLES[variant];
  const Icon = style.icon;

  return (
    <NodeViewWrapper
      className={`flex gap-3 rounded-md border-l-4 p-4 ${style.bg} ${style.border}`}
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${style.iconBg} ${style.iconColor}`}
      >
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={variant}
            onChange={(event) =>
              updateAttributes({ variant: event.target.value as EditorCallout["variant"] })
            }
            aria-label="Callout type"
            className="rounded-md border border-border bg-surface px-2 py-1 text-[12px] font-medium text-fg"
          >
            {CALLOUT_VARIANTS.map((item) => (
              <option key={item} value={item}>
                {LABELS[item]}
              </option>
            ))}
          </select>
          {editor.isEditable ? (
            <button
              type="button"
              onClick={deleteNode}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface/60 hover:text-fg"
              aria-label="Remove callout"
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>
        <input
          value={title}
          onChange={(event) => updateAttributes({ title: event.target.value })}
          placeholder="Callout title"
          aria-label="Callout title"
          className="w-full border-0 bg-transparent text-[16px] leading-6 font-semibold text-fg outline-none placeholder:text-fg-subtle/50"
        />
        <textarea
          value={body}
          onChange={(event) => updateAttributes({ body: event.target.value })}
          rows={3}
          placeholder="What the reader should know."
          aria-label="Callout body"
          className="w-full resize-y border-0 bg-transparent text-[15px] leading-6 text-fg-muted outline-none placeholder:text-fg-subtle/50"
        />
      </div>
    </NodeViewWrapper>
  );
}
