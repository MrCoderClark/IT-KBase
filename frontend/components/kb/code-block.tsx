import { cn } from "@/lib/utils";
import { CodeBlockCopy } from "@/components/kb/code-block-copy";

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
  return (
    <div
      className={cn("group relative overflow-hidden rounded-md", className)}
      style={{ backgroundColor: "#0B1220" }}
    >
      {language ? (
        <span className="absolute top-2.5 left-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/55 select-none">
          {language}
        </span>
      ) : null}

      <CodeBlockCopy code={code} />

      <pre className="overflow-x-auto p-4 pt-5 font-mono text-[13.5px] leading-[22px] font-medium text-[#E6EDF7]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
