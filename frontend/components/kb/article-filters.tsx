"use client";

import { ChevronDown, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ArticleStatus, ArticleCategory } from "@/lib/types/article";

// ---------------------------------------------------------------------------
// Dropdown filter — compact select-like chip that opens a popover
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5
          text-[12px] font-medium leading-4 transition-colors
          ${
            value
              ? "border-accent/30 bg-accent/8 text-accent"
              : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
          }
        `}
      >
        {selectedLabel ?? label}
        {value ? (
          <X
            size={12}
            className="text-accent/60 hover:text-accent"
            aria-hidden
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
          />
        ) : (
          <ChevronDown size={12} aria-hidden />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-border bg-surface py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value === value ? null : opt.value);
                setOpen(false);
              }}
              className={`
                w-full px-3 py-1.5 text-left text-[12px] transition-colors
                ${
                  opt.value === value
                    ? "bg-accent/8 font-semibold text-accent"
                    : "text-fg-muted hover:bg-surface-muted hover:text-fg"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main filters bar
// ---------------------------------------------------------------------------

interface ArticleFiltersProps {
  categories: ArticleCategory[];
  selectedCategory: string | null;
  onCategoryChange: (slug: string | null) => void;
  selectedStatus: ArticleStatus | null;
  onStatusChange: (status: ArticleStatus | null) => void;
  selectedPeriod: string | null;
  onPeriodChange: (period: string | null) => void;
}

const STATUS_OPTIONS: { value: ArticleStatus; label: string }[] = [
  { value: "published", label: "Published" },
  { value: "in_review", label: "In Review" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const PERIOD_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export default function ArticleFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
  selectedPeriod,
  onPeriodChange,
}: ArticleFiltersProps) {
  const hasFilters = selectedCategory || selectedStatus || selectedPeriod;

  return (
    <div className="flex items-center gap-2">
      <FilterDropdown
        label="Category"
        value={selectedCategory}
        options={categories.map((c) => ({ value: c.slug, label: c.name }))}
        onChange={onCategoryChange}
      />
      <FilterDropdown
        label="Status"
        value={selectedStatus}
        options={STATUS_OPTIONS}
        onChange={(v) => onStatusChange(v as ArticleStatus | null)}
      />
      <FilterDropdown
        label="Updated"
        value={selectedPeriod}
        options={PERIOD_OPTIONS}
        onChange={onPeriodChange}
      />

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            onCategoryChange(null);
            onStatusChange(null);
            onPeriodChange(null);
          }}
          className="ml-1 text-[11px] font-medium text-fg-subtle hover:text-accent transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
