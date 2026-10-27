import type { JSONContent } from "@tiptap/core";
import type { EditorCallout, EditorStep } from "@/lib/editor/draft";

export function checklistDoc(items: string[]): JSONContent {
  const rows = items.length > 0 ? items : [""];
  return {
    type: "doc",
    content: rows.map((text) => ({
      type: "checklistItem",
      attrs: { text },
    })),
  };
}

export function checklistFromDoc(doc: JSONContent): string[] {
  const items =
    doc.content
      ?.filter((node) => node.type === "checklistItem")
      .map((node) => String(node.attrs?.text ?? "")) ?? [];
  return items.length > 0 ? items : [""];
}

export function stepsDoc(steps: EditorStep[]): JSONContent {
  const rows =
    steps.length > 0
      ? steps
      : [{ title: "", body: "", code: "", language: "powershell" }];
  return {
    type: "doc",
    content: rows.map((step) => ({
      type: "kbStep",
      attrs: {
        title: step.title,
        body: step.body,
        code: step.code,
        language: step.language || "powershell",
        images: step.images ?? [],
      },
    })),
  };
}

export function stepsFromDoc(doc: JSONContent): EditorStep[] {
  const steps =
    doc.content
      ?.filter((node) => node.type === "kbStep")
      .map((node) => {
        const images = Array.isArray(node.attrs?.images)
          ? (node.attrs.images as string[]).filter(Boolean)
          : [];
        return {
          title: String(node.attrs?.title ?? ""),
          body: String(node.attrs?.body ?? ""),
          code: String(node.attrs?.code ?? ""),
          language: String(node.attrs?.language ?? "powershell"),
          ...(images.length > 0 ? { images } : {}),
        };
      }) ?? [];
  return steps.length > 0
    ? steps
    : [{ title: "", body: "", code: "", language: "powershell" }];
}

export function verificationDoc(items: string[], code: string, language: string): JSONContent {
  const content: JSONContent[] = [...(checklistDoc(items).content ?? [])];
  content.push({
    type: "kbCodeBlock",
    attrs: { code, language: language || "powershell" },
  });
  return { type: "doc", content };
}

export function verificationFromDoc(doc: JSONContent): {
  items: string[];
  code: string;
  language: string;
} {
  const items = checklistFromDoc({
    type: "doc",
    content: doc.content?.filter((node) => node.type === "checklistItem"),
  });
  const codeNode = doc.content?.find((node) => node.type === "kbCodeBlock");
  return {
    items,
    code: String(codeNode?.attrs?.code ?? ""),
    language: String(codeNode?.attrs?.language ?? "powershell"),
  };
}

export function calloutsDoc(callouts: EditorCallout[]): JSONContent {
  const rows =
    callouts.length > 0 ? callouts : [{ variant: "warning" as const, title: "", body: "" }];
  return {
    type: "doc",
    content: rows.map((callout) => ({
      type: "kbCallout",
      attrs: {
        variant: callout.variant,
        title: callout.title,
        body: callout.body,
      },
    })),
  };
}

export function calloutsFromDoc(doc: JSONContent): EditorCallout[] {
  const callouts =
    doc.content
      ?.filter((node) => node.type === "kbCallout")
      .map((node) => ({
        variant: (node.attrs?.variant ?? "warning") as EditorCallout["variant"],
        title: String(node.attrs?.title ?? ""),
        body: String(node.attrs?.body ?? ""),
      })) ?? [];
  return callouts.length > 0
    ? callouts
    : [{ variant: "warning", title: "", body: "" }];
}

export function overviewCalloutDoc(callout: EditorCallout | null): JSONContent {
  if (!callout) return { type: "doc", content: [] };
  return {
    type: "doc",
    content: [
      {
        type: "kbCallout",
        attrs: {
          variant: callout.variant,
          title: callout.title,
          body: callout.body,
        },
      },
    ],
  };
}

export function overviewCalloutFromDoc(doc: JSONContent): EditorCallout | null {
  const node = doc.content?.find((item) => item.type === "kbCallout");
  if (!node) return null;
  return {
    variant: (node.attrs?.variant ?? "important") as EditorCallout["variant"],
    title: String(node.attrs?.title ?? ""),
    body: String(node.attrs?.body ?? ""),
  };
}
