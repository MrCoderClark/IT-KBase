"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Small client island — keeps the code `<pre>` on the server. */
export function CodeBlockCopy({ code }: { code: string }) {
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
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy code"}
      onClick={handleCopy}
      className="absolute top-2.5 right-2.5 inline-flex size-7 items-center justify-center rounded-sm text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white/80"
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );
}
