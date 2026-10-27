"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IMPORT_STAGES, stageIndex, type ImportStageId } from "@/lib/ingestion/stages";

const MAX_BYTES = 25 * 1024 * 1024;

export function ImportForm() {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "running">("idle");
  const [activeStage, setActiveStage] = useState<ImportStageId | null>(null);
  const [doneStages, setDoneStages] = useState<Set<string>>(new Set());
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reject(message: string) {
    if (inputRef.current) inputRef.current.value = "";
    setFileName(null);
    setError(message);
  }

  function accept(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
      reject("Only a .docx or .pdf file can be imported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      reject("That file is larger than 25 MB.");
      return;
    }
    setFileName(file.name);
    setError(null);
  }

  function resetBusy() {
    setPhase("idle");
    busyRef.current = false;
  }

  function watchJob(jobId: string) {
    setPhase("running");
    setActiveStage("parsing");
    setDoneStages(new Set());
    let settled = false;
    const source = new EventSource(`/api/jobs/${jobId}/stream`);

    source.addEventListener("progress", (message) => {
      const data = JSON.parse((message as MessageEvent).data) as {
        stage?: string;
        status?: string;
      };
      if (!data.stage) return;
      if (data.status === "succeeded" || data.stage === "done") {
        setDoneStages((prev) => new Set(prev).add(data.stage!));
      }
      if (data.stage !== "done") {
        setActiveStage(data.stage as ImportStageId);
      } else {
        setActiveStage("done");
      }
    });

    source.addEventListener("done", (message) => {
      if (settled) return;
      settled = true;
      const data = JSON.parse((message as MessageEvent).data) as { slug?: string };
      source.close();
      setDoneStages(new Set(IMPORT_STAGES.map((stage) => stage.id)));
      setActiveStage("done");
      if (!data.slug) {
        setError("The document could not be read.");
        resetBusy();
        return;
      }
      router.push(`/kb/${data.slug}/edit?notice=imported`);
    });

    source.addEventListener("failed", (message) => {
      if (settled) return;
      settled = true;
      const data = JSON.parse((message as MessageEvent).data) as { message?: string };
      source.close();
      setError(data.message ?? "The document could not be read.");
      resetBusy();
    });

    source.onerror = () => {
      if (settled) return;
      settled = true;
      source.close();
      setError("The import connection closed before the draft was ready. Start the import again.");
      resetBusy();
    };
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a Word document or a PDF.");
      return;
    }
    accept(file);
    if (!file.name.toLowerCase().endsWith(".docx") && !file.name.toLowerCase().endsWith(".pdf")) return;
    if (file.size > MAX_BYTES) return;

    setPhase("uploading");
    setError(null);
    setActiveStage(null);
    setDoneStages(new Set());
    busyRef.current = true;
    try {
      const presign = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const signed = (await presign.json()) as {
        key?: string;
        url?: string;
        headers?: Record<string, string>;
        error?: string;
      };
      if (!presign.ok || !signed.url || !signed.key || !signed.headers) {
        setError(signed.error ?? "Object storage did not return an upload URL.");
        resetBusy();
        return;
      }

      const stored = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file });
      if (!stored.ok) {
        setError("The file could not be stored. Check that the bucket allows this site to upload.");
        resetBusy();
        return;
      }

      const done = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: signed.key,
          originalFileName: file.name,
          sizeBytes: file.size,
          sourceKind: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx",
        }),
      });
      const result = (await done.json()) as { jobId?: string; error?: string };
      if (!done.ok || !result.jobId) {
        setError(result.error ?? "The document could not be read.");
        resetBusy();
        return;
      }
      watchJob(result.jobId);
    } catch {
      setError("The file could not be stored. Check that the bucket allows this site to upload.");
      resetBusy();
    }
  }

  const busy = phase !== "idle";
  const label = phase === "uploading" ? "Uploading…" : phase === "running" ? "Working…" : "Create draft";
  const activeIndex = activeStage ? stageIndex(activeStage) : -1;

  return (
    <form
      onSubmit={start}
      className="max-w-[640px] rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,.06),0_8px_24px_rgba(15,23,42,.04)]"
    >
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
          const lower = file.name.toLowerCase();
          const allowed = lower.endsWith(".docx") || lower.endsWith(".pdf");
          if (!allowed || file.size > MAX_BYTES) {
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
          {fileName ?? "Drop a .docx or .pdf here, or choose a file"}
        </span>
        <span className="text-[12px] leading-5 text-fg-subtle">
          Word or PDF, up to 25 MB. A numbered procedure becomes steps. In a Word
          file, each picture stays with the step it follows. A scanned PDF page is
          noted and left unread.
        </span>
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) accept(file);
            else setFileName(null);
          }}
          className="text-[12px] text-fg-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-fg disabled:opacity-60"
        />
      </label>

      {phase === "running" || doneStages.size > 0 ? (
        <ol className="mt-4 space-y-2" aria-live="polite" aria-label="Import progress">
          {IMPORT_STAGES.map((stage, index) => {
            const complete = doneStages.has(stage.id) || (activeIndex > index && stage.id !== "done");
            const current = activeStage === stage.id && !doneStages.has(stage.id);
            return (
              <li
                key={stage.id}
                className={`flex items-center gap-2 text-[13px] ${
                  complete ? "text-fg" : current ? "font-semibold text-accent" : "text-fg-subtle"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    complete
                      ? "bg-accent text-white"
                      : current
                        ? "border border-accent text-accent"
                        : "border border-border text-fg-subtle"
                  }`}
                  aria-hidden
                >
                  {complete ? "✓" : index + 1}
                </span>
                {stage.label}
              </li>
            );
          })}
        </ol>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {label}
      </button>
    </form>
  );
}
