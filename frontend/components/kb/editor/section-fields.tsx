"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Callout } from "@/components/kb/callout";
import { ProseField } from "@/components/kb/editor/prose-field";
import { SectionIcon } from "@/components/kb/section-icon";
import { StepBadge } from "@/components/kb/step-badge";
import {
  CALLOUT_VARIANTS,
  type DraftIssue,
  type EditorCallout,
  type EditorSection,
  type EditorStep,
} from "@/lib/editor/draft";

const CALLOUT_LABELS: Record<(typeof CALLOUT_VARIANTS)[number], string> = {
  info: "Info",
  important: "Important",
  warning: "Warning",
  success: "Success",
};

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
        <input
          value={section.title}
          onChange={(event) => onChange({ ...section, title: event.target.value })}
          aria-label="Section title"
          className={`${fieldClass} min-w-0 text-[15px] font-semibold`}
        />
        <button
          type="button"
          onClick={() => {
            const name = section.title.trim() || "this section";
            if (window.confirm(`Remove “${name}” from this draft?`)) onRemove();
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg"
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
          <Field label="Body">
            <ProseField
              value={section.prose}
              onChange={(prose) => onChange({ ...section, prose })}
              placeholder="What this article covers."
              ariaLabel="Section body"
              minHeight="9rem"
            />
          </Field>
          {section.callout ? (
            <CalloutFields
              callout={section.callout}
              messages={issues
                .filter((issue) => issue.calloutIndex === 0)
                .map((issue) => issue.message)}
              onChange={(callout) => onChange({ ...section, callout })}
              onRemove={() => onChange({ ...section, callout: null })}
            />
          ) : (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...section,
                  callout: { variant: "important", title: "", body: "" },
                })
              }
              className="inline-flex items-center gap-1 text-[12px] font-medium text-accent"
            >
              <Plus size={12} aria-hidden />
              Add callout
            </button>
          )}
        </div>
      );
    case "prerequisites":
      return (
        <ItemList
          items={section.items}
          placeholder="Requirement"
          onChange={(items) => onChange({ ...section, items })}
        />
      );
    case "steps":
      return (
        <div className="space-y-4">
          {section.steps.map((step, index) => (
            <StepFields
              key={index}
              step={step}
              number={index + 1}
              onChange={(next) => {
                const steps = section.steps.slice();
                steps[index] = next;
                onChange({ ...section, steps });
              }}
              onRemove={() =>
                onChange({
                  ...section,
                  steps: section.steps.filter((_, i) => i !== index),
                })
              }
            />
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...section,
                steps: [
                  ...section.steps,
                  { title: "", body: "", code: "", language: "powershell" },
                ],
              })
            }
            className="inline-flex items-center gap-1 text-[12px] font-medium text-accent"
          >
            <Plus size={12} aria-hidden />
            Add step
          </button>
        </div>
      );
    case "verification":
      return (
        <div className="space-y-4">
          <ItemList
            items={section.items}
            placeholder="Check"
            onChange={(items) => onChange({ ...section, items })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Language">
              <input
                value={section.language}
                onChange={(event) => onChange({ ...section, language: event.target.value })}
                className={`${fieldClass} font-mono`}
                placeholder="powershell"
              />
            </Field>
            <Field label="Command">
              <textarea
                value={section.code}
                onChange={(event) => onChange({ ...section, code: event.target.value })}
                rows={3}
                className={`${fieldClass} font-mono`}
                placeholder="nslookup intranet.example.com"
              />
            </Field>
          </div>
        </div>
      );
    case "troubleshooting":
      return (
        <div className="space-y-3">
          {section.callouts.map((callout, index) => (
            <CalloutFields
              key={index}
              callout={callout}
              messages={issues
                .filter((issue) => issue.calloutIndex === index)
                .map((issue) => issue.message)}
              canMoveUp={index > 0}
              canMoveDown={index < section.callouts.length - 1}
              onMove={(direction) => {
                const target = index + direction;
                const callouts = section.callouts.slice();
                const [item] = callouts.splice(index, 1);
                if (!item) return;
                callouts.splice(target, 0, item);
                onChange({ ...section, callouts });
              }}
              onChange={(next) => {
                const callouts = section.callouts.slice();
                callouts[index] = next;
                onChange({ ...section, callouts });
              }}
              onRemove={() =>
                onChange({
                  ...section,
                  callouts: section.callouts.filter((_, i) => i !== index),
                })
              }
            />
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...section,
                callouts: [
                  ...section.callouts,
                  { variant: "warning", title: "", body: "" },
                ],
              })
            }
            className="inline-flex items-center gap-1 text-[12px] font-medium text-accent"
          >
            <Plus size={12} aria-hidden />
            Add callout
          </button>
        </div>
      );
  }
}

function StepFields({
  step,
  number,
  onChange,
  onRemove,
}: {
  step: EditorStep;
  number: number;
  onChange: (step: EditorStep) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-canvas p-3">
      <div className="mb-3 flex items-center gap-2">
        <StepBadge number={number} />
        <input
          value={step.title}
          onChange={(event) => onChange({ ...step, title: event.target.value })}
          className={fieldClass}
          placeholder="Step title"
          aria-label={`Step ${number} title`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg"
          aria-label={`Remove step ${number}`}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="mb-2">
        <ProseField
          value={step.body}
          onChange={(body) => onChange({ ...step, body })}
          placeholder="What to do."
          ariaLabel={`Step ${number} body`}
          minHeight="4.5rem"
        />
      </div>
      {step.images && step.images.length > 0 ? (
        <div className="mb-2 flex flex-col gap-2">
          {step.images.map((src, index) => (
            // The picture is part of the imported step, not a remote layout image.
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
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Language">
          <input
            value={step.language}
            onChange={(event) => onChange({ ...step, language: event.target.value })}
            className={`${fieldClass} font-mono`}
            aria-label={`Step ${number} language`}
            placeholder="powershell"
          />
        </Field>
        <Field label="Command">
          <textarea
            value={step.code}
            onChange={(event) => onChange({ ...step, code: event.target.value })}
            rows={2}
            className={`${fieldClass} font-mono`}
            placeholder="ipconfig /flushdns"
            aria-label={`Step ${number} command`}
          />
        </Field>
      </div>
    </div>
  );
}

function CalloutFields({
  callout,
  messages,
  canMoveUp,
  canMoveDown,
  onMove,
  onChange,
  onRemove,
}: {
  callout: EditorCallout;
  messages: string[];
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: -1 | 1) => void;
  onChange: (callout: EditorCallout) => void;
  onRemove: () => void;
}) {
  const invalid = messages.length > 0;
  return (
    <div className="rounded-lg border border-border bg-canvas p-3">
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <Field label="Type">
          <select
            value={callout.variant}
            onChange={(event) =>
              onChange({
                ...callout,
                variant: event.target.value as EditorCallout["variant"],
              })
            }
            className={`${fieldClass} w-36`}
            aria-label="Callout type"
          >
            {CALLOUT_VARIANTS.map((variant) => (
              <option key={variant} value={variant}>
                {CALLOUT_LABELS[variant]}
              </option>
            ))}
          </select>
        </Field>
        <div className="min-w-[12rem] flex-1">
          <Field label="Title">
            <input
              value={callout.title}
              onChange={(event) => onChange({ ...callout, title: event.target.value })}
              className={fieldClass}
              placeholder="Check DNS configuration"
              aria-invalid={invalid && !callout.title.trim()}
            />
          </Field>
        </div>
        {onMove && (
          <div className="flex gap-1">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              className="inline-flex h-9 w-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg disabled:opacity-30"
              aria-label="Move callout up"
            >
              <ChevronUp size={14} aria-hidden />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              className="inline-flex h-9 w-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg disabled:opacity-30"
              aria-label="Move callout down"
            >
              <ChevronDown size={14} aria-hidden />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-9 w-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg"
          aria-label="Remove callout"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <Field label="Body">
        <textarea
          value={callout.body}
          onChange={(event) => onChange({ ...callout, body: event.target.value })}
          rows={3}
          className={`${fieldClass} break-words`}
          placeholder="What the reader should know."
          aria-invalid={invalid && !callout.body.trim()}
        />
      </Field>
      {messages.map((message) => (
        <p key={message} className="mt-2 text-[12px] font-medium text-warning" role="alert">
          {message}
        </p>
      ))}
      {(callout.title.trim() || callout.body.trim()) && (
        <div className="mt-3">
          <Callout
            variant={callout.variant}
            title={callout.title.trim() || "Callout title"}
          >
            {callout.body.trim() || "Callout body"}
          </Callout>
        </div>
      )}
    </div>
  );
}

function ItemList({
  items,
  placeholder,
  onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const rows = items.length > 0 ? items : [""];
  return (
    <div className="space-y-2">
      {rows.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(event) => {
              const next = rows.slice();
              next[index] = event.target.value;
              onChange(next);
            }}
            className={fieldClass}
            placeholder={placeholder}
            aria-label={`${placeholder} ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-muted hover:text-fg"
            aria-label={`Remove ${placeholder.toLowerCase()} ${index + 1}`}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-accent"
      >
        <Plus size={12} aria-hidden />
        Add item
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-fg-muted">{label}</span>
      {children}
    </label>
  );
}
