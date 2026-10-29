import { prisma } from "@/lib/db";
import { readSiteSettings } from "@/lib/settings/store";

export type PurgeExpiredResult = {
  retentionDays: number;
  cutoff: Date;
  deleted: number;
};

/**
 * Delete ArticleVersion rows older than SiteSetting.versionRetentionDays.
 * Never removes a row pointed at by currentVersionId or draftVersionId.
 */
export async function purgeExpiredVersions(now = new Date()): Promise<PurgeExpiredResult> {
  const settings = await readSiteSettings();
  const retentionDays = settings.versionRetentionDays;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const pointers = await prisma.article.findMany({
    where: {
      OR: [{ currentVersionId: { not: null } }, { draftVersionId: { not: null } }],
    },
    select: { currentVersionId: true, draftVersionId: true },
  });
  const protectedIds = [
    ...new Set(
      pointers.flatMap((row) =>
        [row.currentVersionId, row.draftVersionId].filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  const expired = await prisma.articleVersion.findMany({
    where: {
      createdAt: { lt: cutoff },
      ...(protectedIds.length > 0 ? { id: { notIn: protectedIds } } : {}),
    },
    select: { id: true },
    take: 1000,
  });

  if (expired.length === 0) {
    return { retentionDays, cutoff, deleted: 0 };
  }

  const result = await prisma.articleVersion.deleteMany({
    where: { id: { in: expired.map((row) => row.id) } },
  });

  return { retentionDays, cutoff, deleted: result.count };
}
