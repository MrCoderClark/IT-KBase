export const IMPORT_STAGES = [
  { id: "parsing", label: "Parsing document…" },
  { id: "segmenting", label: "Segmenting content…" },
  { id: "extracting", label: "Extracting structure…" },
  { id: "validating", label: "Validating…" },
  { id: "done", label: "Draft ready." },
] as const;

export type ImportStageId = (typeof IMPORT_STAGES)[number]["id"];

export function stageIndex(id: string): number {
  return IMPORT_STAGES.findIndex((stage) => stage.id === id);
}

export function jobStatusForStage(stage: string): "parsing" | "extracting" | "structuring" | "validating" {
  if (stage === "parsing") return "parsing";
  if (stage === "segmenting") return "extracting";
  if (stage === "extracting") return "structuring";
  return "validating";
}
