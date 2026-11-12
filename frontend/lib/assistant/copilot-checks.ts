/**
 * Authoring-copilot deterministic checks (spec 20 §3.2 B4, B6). Pure functions
 * over an `EditorDraft` — no model call, no backend. B4 flags canonical sections
 * that are missing or empty; B6 scans code blocks for destructive patterns and
 * suggests a Warning callout. Both are suggestions only; nothing mutates the draft.
 */

import {
  EDITABLE_KINDS,
  type EditableKind,
  type EditorDraft,
  type EditorSection,
} from "@/lib/editor/draft";

// ---------------------------------------------------------------------------
// B4 — missing-section check
// ---------------------------------------------------------------------------

export interface SectionSuggestion {
  kind: EditableKind;
  title: string;
  message: string;
  /** "important" sections gate a useful runbook; "optional" ones round it out. */
  priority: "important" | "optional";
}

const SECTION_META: Record<
  EditableKind,
  { title: string; priority: "important" | "optional"; message: string }
> = {
  overview: {
    title: "Overview",
    priority: "important",
    message: "Add an Overview so readers know what this solves and when to use it.",
  },
  prerequisites: {
    title: "Prerequisites",
    priority: "optional",
    message: "List what's needed first — access, tools, or versions.",
  },
  steps: {
    title: "Step-by-Step",
    priority: "important",
    message: "Add the steps that resolve the issue. Every runbook needs at least one.",
  },
  verification: {
    title: "Verification",
    priority: "important",
    message: "Add the checks that confirm the steps actually worked.",
  },
  troubleshooting: {
    title: "Troubleshooting",
    priority: "optional",
    message: "Note common failure points and how to recover from them.",
  },
};

/** A section counts as present only when it has real content, not just a shell. */
function isFilled(section: EditorSection): boolean {
  switch (section.kind) {
    case "overview":
      return (
        section.prose.trim().length > 0 ||
        Boolean(section.callout && (section.callout.title.trim() || section.callout.body.trim()))
      );
    case "prerequisites":
      return section.items.some((item) => item.trim().length > 0);
    case "steps":
      return section.steps.some(
        (step) => step.title.trim() || step.body.trim() || step.code.trim(),
      );
    case "verification":
      return section.items.some((item) => item.trim().length > 0) || section.code.trim().length > 0;
    case "troubleshooting":
      return section.callouts.some((callout) => callout.title.trim() || callout.body.trim());
  }
}

export function missingSections(draft: EditorDraft): SectionSuggestion[] {
  const byKind = new Map<EditableKind, EditorSection>();
  for (const section of draft.sections) {
    if ((EDITABLE_KINDS as readonly string[]).includes(section.kind)) {
      byKind.set(section.kind, section);
    }
  }

  const suggestions: SectionSuggestion[] = [];
  for (const kind of EDITABLE_KINDS) {
    const section = byKind.get(kind);
    if (section && isFilled(section)) continue;
    const meta = SECTION_META[kind];
    suggestions.push({ kind, title: meta.title, message: meta.message, priority: meta.priority });
  }

  // Important sections first, otherwise canonical order.
  return suggestions.sort((a, b) =>
    a.priority === b.priority ? 0 : a.priority === "important" ? -1 : 1,
  );
}

// ---------------------------------------------------------------------------
// B6 — risky-command flag
// ---------------------------------------------------------------------------

export interface RiskyMatch {
  /** Stable key for rendering. */
  id: string;
  /** Human label for the matched pattern, e.g. "rm -rf". */
  label: string;
  /** Where in the draft the code lives, e.g. "Step 2: Reset the agent". */
  where: string;
  /** The offending line, trimmed. */
  line: string;
  advice: string;
}

interface RiskyPattern {
  label: string;
  /** Tested per line; no `g` flag so there is no shared lastIndex to reset. */
  re: RegExp;
  advice: string;
}

const BACKUP_ADVICE = "Wrap this in a Warning callout and add a backup or rollback step before it.";

/**
 * The spec's destructive-pattern list (§3.2 B6) plus a few equally dangerous
 * siblings. Deliberately conservative — `format` needs a drive/switch so a
 * `--format json` flag does not trip it.
 */
export const RISKY_PATTERNS: RiskyPattern[] = [
  { label: "rm -rf", re: /\brm\s+-[a-z]*r[a-z]*/i, advice: BACKUP_ADVICE },
  { label: "Remove-Item -Recurse", re: /Remove-Item\b[^\n]*-Recurse/i, advice: BACKUP_ADVICE },
  {
    label: "diskpart",
    re: /\bdiskpart\b/i,
    advice: "diskpart can wipe the wrong disk. Confirm the disk number and add a Warning callout.",
  },
  {
    label: "clean / clean all",
    re: /^\s*clean(\s+all)?\s*$/i,
    advice: "`clean` erases the selected disk. Add a Warning callout and a backup step.",
  },
  { label: "format", re: /\bformat\s+(?:[a-z]:|\/(?:q|fs|x))/i, advice: BACKUP_ADVICE },
  { label: "Format-Volume", re: /\bFormat-Volume\b/i, advice: BACKUP_ADVICE },
  { label: "Clear-Disk", re: /\bClear-Disk\b/i, advice: BACKUP_ADVICE },
  {
    label: "reg delete",
    re: /\breg\s+delete\b/i,
    advice: "Export the key first (`reg export`) and add a Warning callout.",
  },
  {
    label: "DROP / TRUNCATE",
    re: /\b(DROP\s+(TABLE|DATABASE)|TRUNCATE\s+TABLE)\b/i,
    advice: "Back up the database first and add a Warning callout.",
  },
  {
    label: "Set-ExecutionPolicy Unrestricted",
    re: /Set-ExecutionPolicy\b[^\n]*(Unrestricted|Bypass)/i,
    advice: "Loosening the execution policy is a security risk. Scope it to the process and restore it after.",
  },
  { label: "dd if=", re: /\bdd\s+if=/i, advice: BACKUP_ADVICE },
  { label: "mkfs", re: /\bmkfs\b/i, advice: BACKUP_ADVICE },
  { label: "del /s · rmdir /s", re: /\b(del|rmdir|rd)\b[^\n]*\/s\b/i, advice: BACKUP_ADVICE },
];

interface CodeSource {
  where: string;
  code: string;
}

/** Code blocks live on steps and on the verification section. */
function codeSources(draft: EditorDraft): CodeSource[] {
  const sources: CodeSource[] = [];
  for (const section of draft.sections) {
    if (section.kind === "steps") {
      section.steps.forEach((step, index) => {
        if (step.code.trim()) {
          const title = step.title.trim();
          sources.push({ where: `Step ${index + 1}${title ? `: ${title}` : ""}`, code: step.code });
        }
      });
    } else if (section.kind === "verification" && section.code.trim()) {
      sources.push({ where: section.title.trim() || "Verification", code: section.code });
    }
  }
  return sources;
}

export function riskyCommands(draft: EditorDraft): RiskyMatch[] {
  const matches: RiskyMatch[] = [];
  for (const source of codeSources(draft)) {
    source.code.split(/\r?\n/).forEach((line, lineIndex) => {
      for (const pattern of RISKY_PATTERNS) {
        if (pattern.re.test(line)) {
          matches.push({
            id: `${source.where}:${lineIndex}:${pattern.label}`,
            label: pattern.label,
            where: source.where,
            line: line.trim(),
            advice: pattern.advice,
          });
          break; // one flag per line is enough
        }
      }
    });
  }
  return matches;
}
