import type { EditorDraft } from "@/lib/editor/draft";
import { blankDraft } from "@/lib/editor/draft";

export interface ParsedStep {
  title: string;
  body: string;
  code: string;
  images?: string[];
}

export interface ParsedCallout {
  title: string;
  body: string;
}

/** JSON from POST /v1/parse/docx. */
export interface ParsedDraft {
  title: string;
  summary: string;
  overviewTitle: string;
  overview: string;
  prerequisitesTitle: string;
  prerequisites: string[];
  stepsTitle: string;
  steps: ParsedStep[];
  verificationTitle: string;
  verification: string[];
  verificationCode: string;
  troubleshootingTitle: string;
  troubleshooting: ParsedCallout[];
}

export function parsedToDraft(parsed: ParsedDraft): EditorDraft {
  const draft = blankDraft();
  draft.title = parsed.title;
  draft.summary = parsed.summary;
  draft.sections = draft.sections.map((section) => {
    switch (section.kind) {
      case "overview":
        return {
          ...section,
          title: parsed.overviewTitle || section.title,
          prose: parsed.overview,
        };
      case "prerequisites":
        return parsed.prerequisites.length > 0
          ? { ...section, title: parsed.prerequisitesTitle, items: parsed.prerequisites }
          : section;
      case "steps":
        return parsed.steps.length > 0
          ? {
              ...section,
              title: parsed.stepsTitle,
              steps: parsed.steps.map((step) => ({
                title: step.title,
                body: step.body,
                code: step.code,
                language: step.code ? "text" : "powershell",
                images: step.images ?? [],
              })),
            }
          : section;
      case "verification":
        return parsed.verification.length > 0 || parsed.verificationCode
          ? {
              ...section,
              title: parsed.verificationTitle,
              items: parsed.verification.length > 0 ? parsed.verification : [""],
              code: parsed.verificationCode,
              language: parsed.verificationCode ? "text" : section.language,
            }
          : section;
      case "troubleshooting":
        return parsed.troubleshooting.length > 0
          ? {
              ...section,
              title: parsed.troubleshootingTitle,
              callouts: parsed.troubleshooting.map((callout) => ({
                variant: "warning" as const,
                title: callout.title,
                body: callout.body,
              })),
            }
          : section;
    }
  });
  return draft;
}
