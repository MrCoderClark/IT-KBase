"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

/** Fired by the `s` shortcut so Share can run without focusing the button. */
export const SHARE_EVENT = "tb-share";

export function ShareLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }, []);

  useEffect(() => {
    function onShare() {
      void copyLink();
    }
    window.addEventListener(SHARE_EVENT, onShare);
    return () => {
      window.removeEventListener(SHARE_EVENT, onShare);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [copyLink]);

  const label = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Share";

  return (
    <button
      type="button"
      data-share-link
      onClick={() => void copyLink()}
      aria-live="polite"
      className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3.5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-muted"
    >
      {state === "copied" ? <Check size={14} aria-hidden /> : <Share2 size={14} aria-hidden />}
      {label}
    </button>
  );
}
