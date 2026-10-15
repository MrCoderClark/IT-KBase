import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { saveSiteSettings } from "@/lib/settings/actions";
import { readSiteSettings } from "@/lib/settings/store";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent/30";

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <ArticleListShell title="Settings" description="Loading settings…" showCreate={false}>
          <div />
        </ArticleListShell>
      }
    >
      <SettingsPanel searchParams={searchParams} />
    </Suspense>
  );
}

async function SettingsPanel({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) {
    return (
      <ArticleListShell title="Settings" description="Only an admin can open this page." showCreate={false}>
        <p className="text-[13px] text-fg-muted">You do not have permission to change settings.</p>
      </ArticleListShell>
    );
  }

  const [params, settings] = await Promise.all([searchParams, readSiteSettings()]);
  const message =
    params.e === "accent"
      ? "Accent must be a color like #1E6BFF."
      : params.e === "logo"
        ? "Logo must be an http or https address, or left blank."
        : params.e === "retention"
          ? "Version retention must be between 30 and 3650 days."
          : params.e === "domains"
            ? "Each allowed domain must look like contoso.com."
            : params.notice === "saved"
              ? "Settings saved."
              : null;

  return (
    <ArticleListShell
      title="Settings"
      description="Branding, how long article versions are kept, and which email domains may sign in later."
      showCreate={false}
    >
      {message ? (
        <p role="status" className={`mb-4 text-[13px] font-medium ${params.e ? "text-danger" : "text-fg"}`}>
          {message}
        </p>
      ) : null}
      <form action={saveSiteSettings} className="max-w-xl space-y-6 rounded-xl border border-border bg-surface p-5">
        <fieldset className="space-y-3">
          <legend className="text-[13px] font-semibold text-fg">Branding</legend>
          <div className="flex items-center gap-3">
            <label className="text-[13px] text-fg-muted" htmlFor="accent">
              Accent
            </label>
            <input
              id="accent"
              name="accent"
              type="color"
              defaultValue={settings.accentHex}
              className="h-8 w-12 cursor-pointer rounded-sm border border-border bg-surface"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[13px] text-fg-muted" htmlFor="logoUrl">
              Logo URL
            </label>
            <input
              id="logoUrl"
              name="logoUrl"
              type="url"
              defaultValue={settings.logoUrl ?? ""}
              placeholder="https://"
              className={fieldClass}
            />
            <p className="text-[12px] text-fg-muted">Leave blank to keep the TechBase mark. Buttons and links use the accent.</p>
          </div>
        </fieldset>

        <div className="space-y-1">
          <label className="text-[13px] font-semibold text-fg" htmlFor="versionRetentionDays">
            Keep article versions (days)
          </label>
          <input
            id="versionRetentionDays"
            name="versionRetentionDays"
            type="number"
            min={30}
            max={3650}
            defaultValue={settings.versionRetentionDays}
            className={fieldClass}
          />
          <p className="text-[12px] text-fg-muted">Saved for later. Versions are not deleted yet.</p>
        </div>

        <div className="space-y-1">
          <label className="text-[13px] font-semibold text-fg" htmlFor="allowedEmailDomains">
            Allowed email domains
          </label>
          <textarea
            id="allowedEmailDomains"
            name="allowedEmailDomains"
            rows={4}
            defaultValue={settings.allowedEmailDomains.join("\n")}
            placeholder="contoso.com"
            className={fieldClass}
          />
          <p className="text-[12px] text-fg-muted">
            One domain per line. Used when an identity provider is added. Password and passkey sign-in stay open.
          </p>
        </div>

        <Button type="submit">Save settings</Button>
      </form>
    </ArticleListShell>
  );
}
