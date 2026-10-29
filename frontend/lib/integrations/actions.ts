"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { isIntegrationKind, metaFor } from "./kinds";
import { recordIntegrationTest, saveIntegration } from "./store";

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

export async function saveIntegrationSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isIntegrationKind(kindRaw)) redirect("/admin/integrations?e=kind");
  const meta = metaFor(kindRaw);

  const enabled = formData.get("enabled") === "on";
  const config: Record<string, string> = {};
  for (const field of meta.fields) {
    const raw = String(formData.get(field.name) ?? "");
    if (field.type === "url") {
      const parsed = parseHttpUrl(raw);
      if (parsed === null) redirect(`/admin/integrations?e=url&kind=${kindRaw}`);
      config[field.name] = parsed;
    } else {
      config[field.name] = raw.trim();
    }
  }

  await saveIntegration({ kind: kindRaw, enabled, config });
  revalidatePath("/admin/integrations");
  redirect(`/admin/integrations?notice=saved&kind=${kindRaw}`);
}

export async function testIntegration(formData: FormData): Promise<void> {
  await requireAdmin();
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isIntegrationKind(kindRaw)) redirect("/admin/integrations?e=kind");

  await recordIntegrationTest(kindRaw);
  revalidatePath("/admin/integrations");
  redirect(`/admin/integrations?notice=test&kind=${kindRaw}`);
}
