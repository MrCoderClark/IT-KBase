"use client";

import { Rows3, Rows4 } from "lucide-react";

export type Density = "comfortable" | "compact";

interface DensityToggleProps {
  value: Density;
  onChange: (density: Density) => void;
}

export default function DensityToggle({ value, onChange }: DensityToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5"
      role="radiogroup"
      aria-label="Table density"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "comfortable"}
        aria-label="Comfortable"
        onClick={() => onChange("comfortable")}
        className={`
          rounded-md p-1.5 transition-colors
          ${
            value === "comfortable"
              ? "bg-surface-muted text-fg"
              : "text-fg-subtle hover:text-fg"
          }
        `}
      >
        <Rows3 size={14} aria-hidden />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "compact"}
        aria-label="Compact"
        onClick={() => onChange("compact")}
        className={`
          rounded-md p-1.5 transition-colors
          ${
            value === "compact"
              ? "bg-surface-muted text-fg"
              : "text-fg-subtle hover:text-fg"
          }
        `}
      >
        <Rows4 size={14} aria-hidden />
      </button>
    </div>
  );
}
