import { buttonVariants } from "@/components/ui/button";
import { restoreArticleVersion } from "@/lib/actions/restore-article-version";

export function RestoreVersionForm({ slug, version }: { slug: string; version: string }) {
  return (
    <form action={restoreArticleVersion} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="version" value={version} />
      <p className="text-[13px] text-fg-muted">
        Restore keeps {version} and saves a copy as the new current version.
      </p>
      <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Restore {version}
      </button>
    </form>
  );
}
