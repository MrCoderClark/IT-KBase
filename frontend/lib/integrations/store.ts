import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { INTEGRATION_KINDS, type IntegrationKind } from "./kinds";

export type IntegrationRecord = {
  kind: IntegrationKind;
  enabled: boolean;
  config: Record<string, string>;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastSyncAt: Date | null;
  updatedAt: Date;
};

function asConfig(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

export async function listIntegrations(): Promise<IntegrationRecord[]> {
  const rows = await prisma.integrationSetting.findMany();
  const byKind = new Map(rows.map((row) => [row.kind, row]));
  return INTEGRATION_KINDS.map((kind) => {
    const row = byKind.get(kind);
    return {
      kind,
      enabled: row?.enabled ?? false,
      config: asConfig(row?.config),
      lastTestAt: row?.lastTestAt ?? null,
      lastTestOk: row?.lastTestOk ?? null,
      lastSyncAt: row?.lastSyncAt ?? null,
      updatedAt: row?.updatedAt ?? new Date(0),
    };
  });
}

export async function saveIntegration(input: {
  kind: IntegrationKind;
  enabled: boolean;
  config: Record<string, string>;
}): Promise<void> {
  const config = input.config as Prisma.InputJsonValue;
  await prisma.integrationSetting.upsert({
    where: { kind: input.kind },
    create: {
      kind: input.kind,
      enabled: input.enabled,
      config,
    },
    update: {
      enabled: input.enabled,
      config,
    },
  });
}

/** Placeholder test — records the attempt; no remote call. */
export async function recordIntegrationTest(kind: IntegrationKind): Promise<void> {
  const now = new Date();
  await prisma.integrationSetting.upsert({
    where: { kind },
    create: {
      kind,
      enabled: false,
      config: {},
      lastTestAt: now,
      lastTestOk: false,
    },
    update: {
      lastTestAt: now,
      lastTestOk: false,
    },
  });
}
