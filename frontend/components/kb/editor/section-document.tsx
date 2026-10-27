"use client";

import { useEffect, useRef } from "react";
import { Node } from "@tiptap/core";
import { Plus } from "lucide-react";
import { useEditor, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import { ChecklistItem } from "@/lib/editor/nodes/checklist-item";
import { KbCallout } from "@/lib/editor/nodes/callout";
import { KbCodeBlock } from "@/lib/editor/nodes/code-block";
import { KbStep } from "@/lib/editor/nodes/step";

type Mode = "checklist" | "steps" | "verification" | "callouts" | "overviewCallout";

/**
 * TipTap document for one section kind. Custom nodes match the read view.
 */
export function SectionDocument({
  mode,
  value,
  onChange,
  addLabel,
}: {
  mode: Mode;
  value: JSONContent;
  onChange: (value: JSONContent) => void;
  addLabel: string;
}) {
  const emitted = useRef(JSON.stringify(value));
  const editor = useEditor({
    immediatelyRender: false,
    extensions: extensionsFor(mode),
    content: value,
    editorProps: {
      attributes: {
        class: "outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = current.getJSON();
      const serialized = JSON.stringify(next);
      if (serialized === emitted.current) return;
      emitted.current = serialized;
      onChange(next);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const serialized = JSON.stringify(value);
    if (serialized === emitted.current) return;
    emitted.current = serialized;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="space-y-3">
      {editor ? <EditorContent editor={editor} /> : <div className="min-h-8" />}
      <button
        type="button"
        onClick={() => insertFor(mode, editor)}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-accent"
      >
        <Plus size={12} aria-hidden />
        {addLabel}
      </button>
    </div>
  );
}

/** TipTap requires a text node in every schema, even for atom-only docs. */
const Text = Node.create({
  name: "text",
  group: "inline",
});

function extensionsFor(mode: Mode) {
  const document = Node.create({
    name: "doc",
    topNode: true,
    content: blockContent(mode),
  });
  switch (mode) {
    case "checklist":
      return [document, Text, ChecklistItem];
    case "steps":
      return [document, Text, KbStep];
    case "verification":
      return [document, Text, ChecklistItem, KbCodeBlock];
    case "callouts":
    case "overviewCallout":
      return [document, Text, KbCallout];
  }
}

function blockContent(mode: Mode): string {
  switch (mode) {
    case "checklist":
      return "checklistItem+";
    case "steps":
      return "kbStep+";
    case "verification":
      return "(checklistItem|kbCodeBlock)+";
    case "callouts":
      return "kbCallout+";
    case "overviewCallout":
      return "kbCallout*";
  }
}

function insertFor(mode: Mode, editor: Editor | null) {
  if (!editor) return;
  switch (mode) {
    case "checklist":
      editor.chain().focus().insertContent({ type: "checklistItem", attrs: { text: "" } }).run();
      return;
    case "steps":
      editor
        .chain()
        .focus()
        .insertContent({
          type: "kbStep",
          attrs: { title: "", body: "", code: "", language: "powershell", images: [] },
        })
        .run();
      return;
    case "verification":
      editor
        .chain()
        .focus("start")
        .insertContentAt(1, { type: "checklistItem", attrs: { text: "" } })
        .run();
      return;
    case "callouts":
      editor
        .chain()
        .focus()
        .insertContent({
          type: "kbCallout",
          attrs: { variant: "warning", title: "", body: "" },
        })
        .run();
      return;
    case "overviewCallout": {
      let hasCallout = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === "kbCallout") hasCallout = true;
      });
      if (hasCallout) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "kbCallout",
          attrs: { variant: "important", title: "", body: "" },
        })
        .run();
    }
  }
}
