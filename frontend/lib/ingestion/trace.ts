export type StageTiming = {
  stage: string;
  durationMs: number;
  detail: string;
};

export type IngestTrace = {
  stages: StageTiming[];
  totalMs: number;
};

export function emptyTrace(): IngestTrace {
  return { stages: [], totalMs: 0 };
}

export function recordStage(
  trace: IngestTrace,
  stage: string,
  durationMs: number,
  detail = "",
): IngestTrace {
  const stages = [
    ...trace.stages.filter((item) => item.stage !== stage),
    { stage, durationMs: Math.max(0, Math.round(durationMs)), detail },
  ];
  return {
    stages,
    totalMs: stages.reduce((sum, item) => sum + item.durationMs, 0),
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)} s`;
  return `${Math.round(seconds)} s`;
}
