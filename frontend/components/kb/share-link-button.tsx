"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  const label = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Share";

  return (
    <button
      type="button"
      onClick={copyLink}
      aria-live="polite"
      className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3.5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-muted"
    >
      {state === "copied" ? <Check size={14} aria-hidden /> : <Share2 size={14} aria-hidden />}
      {label}
    </button>
  );
}
