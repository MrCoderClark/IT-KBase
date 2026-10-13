"use client";

import { useState } from "react";
import { Circle, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  nextArticleVersion,
  publishChecks,
  type EditorDraft,
  type VersionBump,
} from "@/lib/editor/draft";

export function PublishDialog({
  draft,
  open,
  pending,
  error,
  onOpenChange,
  onPublish,
}: {
  draft: EditorDraft;
  open: boolean;
  pending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onPublish: (bump: Exclude<VersionBump, "patch">) => void;
}) {
  const [bump, setBump] = useState<Exclude<VersionBump, "patch">>("minor");
  const checks = publishChecks(draft);
  const ready = checks.every((check) => check.ok);
  const next = nextArticleVersion(draft.version, bump);
  const hasHistory = Boolean(draft.version);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setBump("minor");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish article</DialogTitle>
          <DialogDescription>
            Release this version to the knowledge base. Every item below has to pass.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1">
          {checks.map((check) => (
            <li key={check.id} className="flex items-center justify-between gap-3 py-1">
              <span className="flex items-center gap-2 text-[13px] text-fg">
                {check.ok ? (
                  <CircleCheck size={16} className="text-success" aria-hidden />
                ) : (
                  <Circle size={16} className="text-fg-subtle" aria-hidden />
                )}
                {check.label}
              </span>
              <span
                className={
                  check.ok
                    ? "text-[11px] font-semibold tracking-wide text-success uppercase"
                    : "text-[11px] font-semibold tracking-wide text-warning uppercase"
                }
              >
                {check.ok ? "Ready" : "Missing"}
              </span>
            </li>
          ))}
        </ul>

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-medium text-fg-muted">Version</legend>
          {hasHistory ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <VersionChoice
                name="version-bump"
                value="minor"
                checked={bump === "minor"}
                onChange={() => setBump("minor")}
                label="Minor"
                detail={`${draft.version} → ${nextArticleVersion(draft.version, "minor")}`}
              />
              <VersionChoice
                name="version-bump"
                value="major"
                checked={bump === "major"}
                onChange={() => setBump("major")}
                label="Major"
                detail={`${draft.version} → ${nextArticleVersion(draft.version, "major")}`}
              />
            </div>
          ) : (
            <p className="text-[13px] text-fg">This will be version {next}.</p>
          )}
        </fieldset>

        {error && (
          <p className="text-[12px] font-medium text-warning" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!ready || pending} onClick={() => onPublish(bump)}>
            {pending ? "Publishing…" : `Publish ${next}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionChoice({
  name,
  value,
  checked,
  onChange,
  label,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 ${
        checked ? "border-accent bg-accent-soft" : "border-border bg-surface"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-[#1E6BFF]"
      />
      <span>
        <span className="block text-[13px] font-semibold text-fg">{label}</span>
        <span className="block text-[12px] text-fg-muted tabular-nums">{detail}</span>
      </span>
    </label>
  );
}
