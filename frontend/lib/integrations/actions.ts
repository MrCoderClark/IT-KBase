"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { isTemplateId, templateById } from "./templates";
import {
  createIntegrationFromTemplate,
  deleteIntegration,
  getIntegrationById,
  updateIntegration,
} from "./store";
import { testIntegrationConnection } from "./notify";
import { isAllowedWebhookUrl, webhookHostsFor } from "./webhook";

function requireAdmin() {
  return getSession().then((session) => {
    if (!session || !can(session.role, "admin.manage")) redirect("/");
    return session;
  });
}

function parseHttpUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function addIntegration(formData: FormData): Promise<void> {
  await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "");
  if (!isTemplateId(templateId)) redirect("/admin/integrations?e=template");

  const template = templateById(templateId)!;
  const name = String(formData.get("name") ?? "").trim() || template.name;
  const description = String(formData.get("description") ?? "").trim();

  const row = await createIntegrationFromTemplate({
    templateId,
    name,
    description: description || undefined,
  });

  revalidatePath("/admin/integrations");
  redirect(`/admin/integrations?notice=added&id=${row.id}`);
}

export async function saveIntegrationSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const existing = await getIntegrationById(id);
  if (!existing) redirect("/admin/integrations?e=missing");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/admin/integrations?e=name&id=${id}`);

  const description = String(formData.get("description") ?? "").trim();
  const enabled = formData.get("enabled") === "on";
  const hosts = webhookHostsFor(existing);
  const config: Record<string, string> = { ...existing.config };

  for (const field of existing.fieldSchema) {
    const raw = String(formData.get(field.name) ?? "");
    if (field.type === "password" && !raw.trim()) {
      // Keep the stored secret when the field is left blank.
      continue;
    }
    if (field.type === "url" || field.name === existing.webhookUrlKey) {
      const parsed = parseHttpUrl(raw);
      if (parsed === null) redirect(`/admin/integrations?e=url&id=${id}`);
      if (field.name === existing.webhookUrlKey && parsed && !isAllowedWebhookUrl(parsed, hosts)) {
        redirect(`/admin/integrations?e=host&id=${id}`);
      }
      config[field.name] = parsed;
    } else {
      config[field.name] = raw.trim();
    }
  }

  await updateIntegration({ id, name, description, enabled, config });
  revalidatePath("/admin/integrations");
  redirect(`/admin/integrations?notice=saved&id=${id}`);
}

export async function removeIntegration(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const existing = await getIntegrationById(id);
  if (!existing) redirect("/admin/integrations?e=missing");

  await deleteIntegration(id);
  revalidatePath("/admin/integrations");
  redirect("/admin/integrations?notice=removed");
}

export async function testIntegration(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const existing = await getIntegrationById(id);
  if (!existing) redirect("/admin/integrations?e=missing");

  const result = await testIntegrationConnection(id);
  revalidatePath("/admin/integrations");
  if (!result.ok) {
    redirect(
      `/admin/integrations?e=test&id=${id}&m=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/admin/integrations?notice=test_ok&id=${id}`);
}
