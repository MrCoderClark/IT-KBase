import { prisma } from "@/lib/db";
import { DEFAULT_SITE_SETTINGS, SITE_SETTING_ID, type SiteSettings } from "./site-settings";

export async function readSiteSettings(): Promise<SiteSettings> {
  const row = await prisma.siteSetting.findUnique({
    where: { id: SITE_SETTING_ID },
    select: {
      accentHex: true,
      logoUrl: true,
      versionRetentionDays: true,
      allowedEmailDomains: true,
    },
  });
  if (!row) return DEFAULT_SITE_SETTINGS;
  return row;
}

export async function writeSiteSettings(settings: SiteSettings): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { id: SITE_SETTING_ID },
    create: { id: SITE_SETTING_ID, ...settings },
    update: settings,
  });
}
