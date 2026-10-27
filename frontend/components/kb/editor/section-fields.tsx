"use client";

import { X } from "lucide-react";
import { ProseField } from "@/components/kb/editor/prose-field";
import { SectionDocument } from "@/components/kb/editor/section-document";
import { SectionIcon } from "@/components/kb/section-icon";
import {
  type DraftIssue,
  type EditorSection,
} from "@/lib/editor/draft";
import {
  calloutsDoc,
  calloutsFromDoc,
  checklistDoc,
  checklistFromDoc,
  overviewCalloutDoc,
  overviewCalloutFromDoc,
  stepsDoc,
  stepsFromDoc,
  verificationDoc,
  verificationFromDoc,
} from "@/lib/editor/section-doc";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg placeholder:text-fg-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30";

export function SectionCard({
  section,
  issues,
  onChange,
  onRemove,
}: {
  section: EditorSection;
  issues: DraftIssue[];
  onChange: (section: EditorSection) => void;
  onRemove: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,.06)]">
      <div className="mb-4 flex items-center gap-3">
        <SectionIcon kind={section.kind} />
        <div className="min-w-0 flex-1">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
            Section heading
          </span>
          <input
            value={section.title}
            onChange={(event) => onChange({ ...section, title: event.target.value })}
            aria-label={`${section.kind} section heading`}
            className={`${fieldClass} min-w-0 text-[14px] font-semibold`}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const name = section.title.trim() || "this section";
            if (window.confirm(`Remove “${name}” from this draft?`)) onRemove();
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg"
          aria-label={`Remove ${section.title}`}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <SectionBody section={section} issues={issues} onChange={onChange} />
    </section>
  );
}

function SectionBody({
  section,
  issues,
  onChange,
}: {
  section: EditorSection;
  issues: DraftIssue[];
  onChange: (section: EditorSection) => void;
}) {
  switch (section.kind) {
    case "overview":
      return (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-fg-muted">Body</span>
            <ProseField
              value={section.prose}
              onChange={(prose) => onChange({ ...section, prose })}
              placeholder="What this article covers."
              ariaLabel="Section body"
              minHeight="9rem"
            />
          </label>
          {issues
            .filter((issue) => issue.calloutIndex === 0)
            .map((issue) => (
              <p key={issue.message} className="text-[12px] font-medium text-warning" role="alert">
                {issue.message}
              </p>
            ))}
          <SectionDocument
            mode="overviewCallout"
            value={overviewCalloutDoc(section.callout)}
            onChange={(doc) => onChange({ ...section, callout: overviewCalloutFromDoc(doc) })}
            addLabel="Add callout"
          />
        </div>
      );
    case "prerequisites":
      return (
        <SectionDocument
          mode="checklist"
          value={checklistDoc(section.items)}
          onChange={(doc) => onChange({ ...section, items: checklistFromDoc(doc) })}
          addLabel="Add item"
        />
      );
    case "steps":
      return (
        <SectionDocument
          mode="steps"
          value={stepsDoc(section.steps)}
          onChange={(doc) => onChange({ ...section, steps: stepsFromDoc(doc) })}
          addLabel="Add step"
        />
      );
    case "verification": {
      const parsed = { items: section.items, code: section.code, language: section.language };
      return (
        <SectionDocument
          mode="verification"
          value={verificationDoc(parsed.items, parsed.code, parsed.language)}
          onChange={(doc) => {
            const next = verificationFromDoc(doc);
            onChange({ ...section, ...next });
          }}
          addLabel="Add check"
        />
      );
    }
    case "troubleshooting":
      return (
        <div className="space-y-3">
          {issues.map((issue) => (
            <p key={issue.message} className="text-[12px] font-medium text-warning" role="alert">
              {issue.message}
            </p>
          ))}
          <SectionDocument
            mode="callouts"
            value={calloutsDoc(section.callouts)}
            onChange={(doc) => onChange({ ...section, callouts: calloutsFromDoc(doc) })}
            addLabel="Add callout"
          />
        </div>
      );
  }
}
