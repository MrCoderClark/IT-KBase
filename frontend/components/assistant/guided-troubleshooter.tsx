"use client";

/**
 * Guided troubleshooting checklist (spec 20 §3 A6). Walks the article's steps;
 * on "didn't work" it surfaces the matching Troubleshooting callout(s), or lets
 * the user hand the step to the assistant. Deterministic — no model call.
 */

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Callout } from "@/components/kb/callout";
import { StepBadge } from "@/components/kb/step-badge";
import { cn } from "@/lib/utils";
import { matchTroubleshooting, type GuideStep, type TroubleItem } from "@/lib/assistant/troubleshooting";

type Status = "pending" | "ok" | "failed";

export function GuidedTroubleshooter({
  steps,
  troubleshooting,
  onAskAboutStep,
}: {
  steps: GuideStep[];
  troubleshooting: TroubleItem[];
  onAskAboutStep: (step: GuideStep) => void;
}) {
  const [status, setStatus] = useState<Record<number, Status>>({});
  const checked = steps.filter((s) => status[s.stepNumber] && status[s.stepNumber] !== "pending").length;
  const allOk = steps.length > 0 && steps.every((s) => status[s.stepNumber] === "ok");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-medium text-fg">Work through the steps</p>
        <span className="text-[12px] text-fg-subtle">
          {checked}/{steps.length} checked
        </span>
      </div>

      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <StepRow
            key={step.stepNumber}
            step={step}
            troubleshooting={troubleshooting}
            status={status[step.stepNumber] ?? "pending"}
            onSet={(s) => setStatus((prev) => ({ ...prev, [step.stepNumber]: s }))}
            onAsk={() => onAskAboutStep(step)}
          />
        ))}
      </ol>

      {allOk ? (
        <div className="mt-4 rounded-lg border border-success/40 bg-success-soft p-4 text-[13px] text-fg">
          <span className="font-medium">All steps completed.</span> If the issue persists, use Ask to
          dig deeper or request an update to this article.
        </div>
      ) : null}
    </div>
  );
}

function StepRow({
  step,
  troubleshooting,
  status,
  onSet,
  onAsk,
}: {
  step: GuideStep;
  troubleshooting: TroubleItem[];
  status: Status;
  onSet: (s: Status) => void;
  onAsk: () => void;
}) {
  const matched = useMemo(
    () => (status === "failed" ? matchTroubleshooting(step, troubleshooting) : []),
    [status, step, troubleshooting],
  );
  const shown = matched.length > 0 ? matched : troubleshooting;

  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        status === "ok"
          ? "border-success/40 bg-success-soft/40"
          : status === "failed"
            ? "border-warning/40 bg-warning-soft/40"
            : "border-border bg-surface",
      )}
    >
      <div className="flex items-start gap-3">
        <StepBadge number={step.stepNumber} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">{step.title}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <StatusButton active={status === "ok"} tone="ok" onClick={() => onSet("ok")}>
              <Check className="size-3.5" aria-hidden /> Worked
            </StatusButton>
            <StatusButton active={status === "failed"} tone="fail" onClick={() => onSet("failed")}>
              <X className="size-3.5" aria-hidden /> Didn&apos;t work
            </StatusButton>
          </div>
        </div>
      </div>

      {status === "failed" ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          {shown.length > 0 ? (
            <>
              <p className="text-[12px] font-medium text-fg-muted">
                {matched.length > 0 ? "Matching troubleshooting" : "Troubleshooting"}
              </p>
              {shown.map((item) => (
                <Callout key={item.id} variant={item.variant} title={item.title}>
                  <span dangerouslySetInnerHTML={{ __html: item.content }} />
                </Callout>
              ))}
            </>
          ) : (
            <p className="text-[13px] text-fg-muted">
              No troubleshooting note covers this step.
            </p>
          )}
          <button
            type="button"
            onClick={onAsk}
            className="self-start rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-accent-soft"
          >
            Ask the assistant about this step
          </button>
        </div>
      ) : null}
    </li>
  );
}

function StatusButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "ok" | "fail";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "ok"
      ? "border-success bg-success text-white"
      : "border-warning bg-warning text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition",
        active ? activeCls : "border-border text-fg-muted hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}
