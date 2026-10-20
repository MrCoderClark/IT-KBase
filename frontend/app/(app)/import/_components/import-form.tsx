"use client";

import { useActionState, useRef, useState } from "react";
import { importDocx, type ImportState } from "@/lib/actions/import-docx";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importDocx, null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reject(message: string) {
    if (inputRef.current) inputRef.current.value = "";
    setFileName(null);
    setLocalError(message);
  }

  function accept(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      reject("Only a .docx file can be imported. PDF comes later.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      reject("That file is larger than 25 MB.");
      return;
    }
    setFileName(file.name);
    setLocalError(null);
  }

  const error = localError ?? state?.error ?? null;

  return (
    <form action={action} className="max-w-[640px] rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,.06),0_8px_24px_rgba(15,23,42,.04)]">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          const input = inputRef.current;
          if (!file || !input) return;
          if (!file.name.toLowerCase().endsWith(".docx") || file.size > 25 * 1024 * 1024) {
            accept(file);
            return;
          }
          const transfer = new DataTransfer();
          transfer.items.add(file);
          input.files = transfer.files;
          accept(file);
        }}
        className={`flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed px-4 py-6 ${
          dragOver ? "border-accent bg-accent-soft" : "border-border-strong bg-surface-muted"
        }`}
      >
        <span className="text-[13px] font-semibold text-fg">
          {fileName ?? "Drop a .docx here, or choose a file"}
        </span>
        <span className="text-[12px] leading-5 text-fg-subtle">
          Word documents up to 25 MB. A numbered procedure becomes steps, and each
          picture stays with the step it follows. Headings such as Overview and
          Prerequisites become those sections.
        </span>
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) accept(file);
            else setFileName(null);
          }}
          className="text-[12px] text-fg-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-fg"
        />
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Reading document…" : "Create draft"}
      </button>
    </form>
  );
}
