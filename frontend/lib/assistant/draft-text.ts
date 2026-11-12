/**
 * Flatten an EditorDraft into plain text for the tidy copilot (spec 20 §3.2 B3).
 * Keeps section boundaries and code fences so the model can restructure without
 * losing commands. Pure — unit-tested.
 */

import type { EditorDraft } from "@/lib/editor/draft";

export function editorDraftToText(draft: EditorDraft): string {
  const lines: string[] = [];
  if (draft.title.trim()) lines.push(`Title: ${draft.title.trim()}`);
  if (draft.summary.trim()) lines.push(`Summary: ${draft.summary.trim()}`);

  for (const section of draft.sections) {
    switch (section.kind) {
      case "overview": {
        if (section.prose.trim()) lines.push(`\nOverview:\n${stripTags(section.prose)}`);
        const callout = section.callout;
        if (callout && (callout.title.trim() || callout.body.trim())) {
          lines.push(`Note (${callout.variant}): ${callout.title.trim()} — ${stripTags(callout.body)}`);
        }
        break;
      }
      case "prerequisites": {
        const items = section.items.filter((item) => item.trim());
        if (items.length > 0) {
          lines.push("\nPrerequisites:");
          for (const item of items) lines.push(`- ${item.trim()}`);
        }
        break;
      }
      case "steps": {
        const steps = section.steps.filter(
          (step) => step.title.trim() || step.body.trim() || step.code.trim(),
        );
        if (steps.length > 0) {
          lines.push("\nSteps:");
          steps.forEach((step, index) => {
            lines.push(`${index + 1}. ${step.title.trim()}`.trim());
            if (step.body.trim()) lines.push(stripTags(step.body));
            if (step.code.trim()) lines.push("```\n" + step.code.trim() + "\n```");
          });
        }
        break;
      }
      case "verification": {
        const items = section.items.filter((item) => item.trim());
        if (items.length > 0 || section.code.trim()) {
          lines.push("\nVerification:");
          for (const item of items) lines.push(`- ${item.trim()}`);
          if (section.code.trim()) lines.push("```\n" + section.code.trim() + "\n```");
        }
        break;
      }
      case "troubleshooting": {
        const callouts = section.callouts.filter((c) => c.title.trim() || c.body.trim());
        if (callouts.length > 0) {
          lines.push("\nTroubleshooting:");
          for (const c of callouts) lines.push(`- ${c.title.trim()}: ${stripTags(c.body)}`);
        }
        break;
      }
    }
  }

  return lines.join("\n").trim();
}

/** Light tag strip — section bodies may hold simple editor HTML. */
function stripTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
