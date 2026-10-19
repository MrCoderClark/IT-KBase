import Link from "next/link";
import { RestoreVersionForm } from "@/app/(app)/kb/[slug]/history/_components/restore-version-form";
import type { ComparedSection } from "@/lib/kb/section-compare";

function statusLabel(status: ComparedSection["status"], selectedVersion: string): string {
  if (status === "only-left") return "Only in current";
  if (status === "only-right") return `Only in ${selectedVersion}`;
  if (status === "changed") return "Changed";
  return "Unchanged";
}

export function VersionCompare({
  slug,
  currentVersion,
  selectedVersion,
  rows,
  canRestore = false,
}: {
  slug: string;
  currentVersion: string;
  selectedVersion: string;
  rows: ComparedSection[];
  canRestore?: boolean;
}) {
  const changed = rows.filter((row) => row.status !== "unchanged").length;
  const differ =
    changed === 0 ? "No sections differ" : changed === 1 ? "1 section differs" : `${changed} sections differ`;

  return (
    <div className="w-full px-6 py-6">
      <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg">
        Current {currentVersion} is on the left. {selectedVersion} is on the right. {differ}. Sections line up in
        order.{" "}
        <Link
          href={`/kb/${slug}/history?v=${encodeURIComponent(selectedVersion)}`}
          className="font-semibold text-accent hover:underline"
        >
          Read {selectedVersion}
        </Link>
        {" · "}
        <Link href={`/kb/${slug}/history`} className="font-semibold text-accent hover:underline">
          All versions
        </Link>
      </p>
      {canRestore ? <div className="mb-4"><RestoreVersionForm slug={slug} version={selectedVersion} /></div> : null}
      <div className="mb-3 grid grid-cols-2 gap-4 text-[12px] font-semibold tracking-wide text-fg-muted uppercase">
        <p>Current {currentVersion}</p>
        <p>Selected {selectedVersion}</p>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <CompareRow key={index} row={row} selectedVersion={selectedVersion} />
        ))}
      </div>
    </div>
  );
}

function CompareRow({ row, selectedVersion }: { row: ComparedSection; selectedVersion: string }) {
  const title = row.left?.title || row.right?.title || "Section";
  if (row.status === "unchanged") {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
        <span className="font-semibold text-fg">{title}</span>
        <span className="ml-2 text-fg-muted">Unchanged</span>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
        <span className="text-[12px] font-semibold text-accent">{statusLabel(row.status, selectedVersion)}</span>
      </header>
      <div className="grid grid-cols-2">
        <Column text={row.left?.text} empty="Not in the current version" />
        <Column text={row.right?.text} empty="Not in the selected version" edge />
      </div>
    </section>
  );
}

function Column({ text, empty, edge }: { text?: string; empty: string; edge?: boolean }) {
  return (
    <div className={edge ? "border-l border-border px-4 py-3" : "px-4 py-3"}>
      <p className="text-[13px] leading-6 whitespace-pre-wrap text-fg">{text ?? empty}</p>
    </div>
  );
}
