"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * Paragraph editor for overview and step bodies.
 * The value stays plain text: blank lines are paragraphs, single newlines
 * are line breaks. Marks and lists are off so a save cannot invent markup.
 */
export function ProseField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  minHeight = "7.5rem",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  minHeight?: string;
}) {
  const emitted = useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        underline: false,
        trailingNode: false,
      }),
    ],
    content: textToHtml(value),
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: "min-w-0 outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = docToPlain(current.getJSON());
      if (next === emitted.current) return;
      emitted.current = next;
      onChange(next);
    },
  });

  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(textToHtml(value), { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="relative w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30">
      {value.length === 0 ? (
        <span className="pointer-events-none absolute top-2 left-3 text-fg-subtle/50">
          {placeholder}
        </span>
      ) : null}
      {editor ? (
        <EditorContent editor={editor} style={{ minHeight }} />
      ) : (
        <div className="whitespace-pre-wrap" style={{ minHeight }}>
          {value}
        </div>
      )}
    </div>
  );
}

function textToHtml(value: string): string {
  if (!value) return "<p></p>";
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function docToPlain(doc: JSONContent): string {
  return (doc.content ?? []).map((block) => inlineToText(block.content ?? [])).join("\n\n");
}

function inlineToText(nodes: JSONContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.text) return node.text;
      if (node.content) return inlineToText(node.content);
      return "";
    })
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
