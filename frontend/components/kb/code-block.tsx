"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dark code block with a copy affordance (top-right).
 *
 * Bg is always #0B1220 (constant across themes). Monospace.
 * Matches 02-design-system.md §6.6.
 */
export function CodeBlock({
  code,
  language,
  className,
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API unavailable in some contexts */
    }
  }, [code]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-md",
        className,
      )}
      style={{ backgroundColor: "#0B1220" }}
    >
      {language ? (
        <span className="absolute top-2.5 left-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/30 select-none">
          {language}
        </span>
      ) : null}

      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy code"}
        onClick={handleCopy}
        className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-sm text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/80"
      >
        {copied ? (
          <Check size={14} aria-hidden />
        ) : (
          <Copy size={14} aria-hidden />
        )}
      </button>

      <pre className="overflow-x-auto p-4 pt-5 font-mono text-[13.5px] leading-[22px] font-medium text-[#E6EDF7]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
