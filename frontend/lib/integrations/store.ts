import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { templateById } from "./templates";
import type { IntegrationField, IntegrationIconKey, IntegrationRecord } from "./types";

function asConfig(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function asFields(value: unknown): IntegrationField[] {
  if (!Array.isArray(value)) return [];
  const out: IntegrationField[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.name !== "string" || typeof row.label !== "string") continue;
    const type = row.type === "url" || row.type === "password" || row.type === "text" ? row.type : "text";
    out.push({
      name: row.name,
      label: row.label,
      type,
      placeholder: typeof row.placeholder === "string" ? row.placeholder : undefined,
      hint: typeof row.hint === "string" ? row.hint : undefined,
    });
  }
  return out;
}

function asIconKey(value: string): IntegrationIconKey {
  const keys: IntegrationIconKey[] = ["puzzle", "message", "users", "ticket", "cloud", "webhook"];
  return keys.includes(value as IntegrationIconKey) ? (value as IntegrationIconKey) : "puzzle";
}

function toRecord(row: {
  id: string;
  slug: string;
  name: string;
  description: string;
  templateId: string;
  accentHex: string;
  iconKey: string;
  enabled: boolean;
  fieldSchema: unknown;
  config: unknown;
  webhookUrlKey: string | null;
  notifyOnPublish: boolean;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastSyncAt: Date | null;
  updatedAt: Date;
}): IntegrationRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    templateId: row.templateId,
    accentHex: row.accentHex,
    iconKey: asIconKey(row.iconKey),
    enabled: row.enabled,
    fieldSchema: asFields(row.fieldSchema),
    config: asConfig(row.config),
    webhookUrlKey: row.webhookUrlKey,
    notifyOnPublish: row.notifyOnPublish,
    lastTestAt: row.lastTestAt,
    lastTestOk: row.lastTestOk,
    lastSyncAt: row.lastSyncAt,
    updatedAt: row.updatedAt,
  };
}

export async function listIntegrations(): Promise<IntegrationRecord[]> {
  const rows = await prisma.integration.findMany({ orderBy: { name: "asc" } });
  return rows.map(toRecord);
}

export async function getIntegrationById(id: string): Promise<IntegrationRecord | null> {
  const row = await prisma.integration.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

export async function listPublishIntegrations(): Promise<IntegrationRecord[]> {
  const rows = await prisma.integration.findMany({
    where: { enabled: true, notifyOnPublish: true },
  });
  return rows.map(toRecord);
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || "integration";
}

export async function uniqueIntegrationSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 20; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await prisma.integration.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createIntegrationFromTemplate(input: {
  templateId: string;
  name: string;
  description?: string;
}): Promise<IntegrationRecord> {
  const template = templateById(input.templateId);
  if (!template) throw new Error("Unknown template.");

  const name = input.name.trim() || template.name;
  const slug = await uniqueIntegrationSlug(name);
  const row = await prisma.integration.create({
    data: {
      slug,
      name,
      description: (input.description ?? template.summary).trim(),
      templateId: template.id,
      accentHex: template.accentHex,
      iconKey: template.iconKey,
      enabled: false,
      fieldSchema: template.fields as unknown as Prisma.InputJsonValue,
      config: {},
      webhookUrlKey: template.webhookUrlKey,
      notifyOnPublish: template.notifyOnPublish,
    },
  });
  return toRecord(row);
}

export async function updateIntegration(input: {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, string>;
}): Promise<void> {
  await prisma.integration.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      enabled: input.enabled,
      config: input.config as Prisma.InputJsonValue,
    },
  });
}

export async function deleteIntegration(id: string): Promise<void> {
  await prisma.integration.delete({ where: { id } });
}

export async function markIntegrationTest(id: string, ok: boolean): Promise<void> {
  await prisma.integration.update({
    where: { id },
    data: { lastTestAt: new Date(), lastTestOk: ok },
  });
}

export async function markIntegrationSynced(id: string): Promise<void> {
  await prisma.integration.update({
    where: { id },
    data: { lastSyncAt: new Date() },
  });
}

export async function markIntegrationTestStub(id: string): Promise<void> {
  await prisma.integration.update({
    where: { id },
    data: { lastTestAt: new Date(), lastTestOk: null },
  });
}
