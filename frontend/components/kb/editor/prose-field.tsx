"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

/**
 * Overview and step body editor. Bold, italic, and lists are stored as HTML.
 * Headings, links, and code marks stay off.
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
  const [empty, setEmpty] = useState(isBlank(value));
  const [marks, setMarks] = useState({
    bold: false,
    italic: false,
    bullet: false,
    ordered: false,
  });
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false,
        trailingNode: false,
      }),
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class:
          "min-w-0 outline-none [&_em]:italic [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: current }) => {
      sync(current, setEmpty, setMarks);
      const next = storedHtml(current.getHTML());
      if (next === emitted.current) return;
      emitted.current = next;
      onChange(next);
    },
    onSelectionUpdate: ({ editor: current }) => {
      sync(current, setEmpty, setMarks);
    },
  });

  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
    setEmpty(editor.isEmpty);
  }, [editor, value]);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-surface text-[13px] leading-5 text-fg focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30">
      <div className="flex gap-0.5 border-b border-border px-1.5 py-1">
        <MarkButton
          label="Bold"
          active={marks.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </MarkButton>
        <MarkButton
          label="Italic"
          active={marks.italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </MarkButton>
        <MarkButton
          label="Bullet list"
          active={marks.bullet}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </MarkButton>
        <MarkButton
          label="Numbered list"
          active={marks.ordered}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </MarkButton>
      </div>
      <div className="relative px-3 py-2">
        {empty ? (
          <span className="pointer-events-none absolute top-2 left-3 text-fg-subtle/50">
            {placeholder}
          </span>
        ) : null}
        {editor ? (
          <EditorContent editor={editor} style={{ minHeight }} />
        ) : (
          <div style={{ minHeight }} />
        )}
      </div>
    </div>
  );
}

function MarkButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex size-7 items-center justify-center rounded-sm ${
        active
          ? "bg-accent-soft text-accent"
          : "text-fg-muted hover:bg-surface-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function sync(
  editor: Editor,
  setEmpty: (empty: boolean) => void,
  setMarks: (marks: {
    bold: boolean;
    italic: boolean;
    bullet: boolean;
    ordered: boolean;
  }) => void,
) {
  setEmpty(editor.isEmpty);
  setMarks({
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    bullet: editor.isActive("bulletList"),
    ordered: editor.isActive("orderedList"),
  });
}

function toEditorHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "<p></p>";
  if (/<\/?(p|br|strong|em|ul|ol|li)\b/i.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Drop the empty document so a blank field does not save a paragraph tag. */
function storedHtml(html: string): string {
  const trimmed = html.trim();
  return trimmed === "<p></p>" ? "" : trimmed;
}

function isBlank(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || trimmed === "<p></p>";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
