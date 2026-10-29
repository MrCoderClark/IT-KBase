import type { components } from "@/lib/api/generated/ingestion";
import type { EditorDraft } from "@/lib/editor/draft";
import { blankDraft } from "@/lib/editor/draft";

export type ParsedStep = components["schemas"]["ParsedStep"];
export type ParsedCallout = components["schemas"]["ParsedCallout"];
/** JSON from POST /v1/parse/docx and the ingest draft payload. */
export type ParsedDraft = components["schemas"]["ParsedDraft"];
export type IngestBody = components["schemas"]["IngestBody"];
/** `/ingest` streams SSE, so OpenAPI has no IngestResult schema — draft is nested in events. */

export function parsedToDraft(parsed: ParsedDraft): EditorDraft {
  const prerequisites = parsed.prerequisites ?? [];
  const steps = parsed.steps ?? [];
  const verification = parsed.verification ?? [];
  const troubleshooting = parsed.troubleshooting ?? [];

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
        return prerequisites.length > 0
          ? { ...section, title: parsed.prerequisitesTitle, items: prerequisites }
          : section;
      case "steps":
        return steps.length > 0
          ? {
              ...section,
              title: parsed.stepsTitle,
              steps: steps.map((step) => ({
                title: step.title,
                body: step.body,
                code: step.code,
                language: step.code ? "text" : "powershell",
                images: step.images ?? [],
              })),
            }
          : section;
      case "verification":
        return verification.length > 0 || parsed.verificationCode
          ? {
              ...section,
              title: parsed.verificationTitle,
              items: verification.length > 0 ? verification : [""],
              code: parsed.verificationCode,
              language: parsed.verificationCode ? "text" : section.language,
            }
          : section;
      case "troubleshooting":
        return troubleshooting.length > 0
          ? {
              ...section,
              title: parsed.troubleshootingTitle,
              callouts: troubleshooting.map((callout) => ({
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
