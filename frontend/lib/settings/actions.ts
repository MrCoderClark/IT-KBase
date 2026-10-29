"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { purgeExpiredVersions } from "@/lib/versions/purge-expired";
import { parseAccent, parseEmailDomains, parseLogoUrl, parseRetentionDays } from "./site-settings";
import { writeSiteSettings } from "./store";

export async function saveSiteSettings(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) redirect("/");

  const accentHex = parseAccent(String(formData.get("accent") ?? ""));
  if (!accentHex) redirect("/admin/settings?e=accent");

  const logo = parseLogoUrl(String(formData.get("logoUrl") ?? ""));
  if (!logo.ok) redirect("/admin/settings?e=logo");

  const versionRetentionDays = parseRetentionDays(String(formData.get("versionRetentionDays") ?? ""));
  if (versionRetentionDays === null) redirect("/admin/settings?e=retention");

  const domains = parseEmailDomains(String(formData.get("allowedEmailDomains") ?? ""));
  if (!domains.ok) redirect("/admin/settings?e=domains");

  await writeSiteSettings({
    accentHex,
    logoUrl: logo.logoUrl,
    versionRetentionDays,
    allowedEmailDomains: domains.domains,
  });
  revalidatePath("/", "layout");
  redirect("/admin/settings?notice=saved");
}

/** Admin-triggered retention pass (same rules as the cron job). */
export async function runVersionRetentionNow(_formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) redirect("/");

  const result = await purgeExpiredVersions();
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?notice=retention&deleted=${result.deleted}#version-retention`);
}
