import Link from "next/link";
import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { auditActionLabel } from "@/lib/auth/audit-labels";
import { can } from "@/lib/auth/policy";
import { getSession, resolveClientIp } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 50;

export default function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <ArticleListShell title="Audit" description="Loading auth events…" showCreate={false}>
          <div />
        </ArticleListShell>
      }
    >
      <AuditPanel searchParams={searchParams} />
    </Suspense>
  );
}

async function AuditPanel({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) {
    return (
      <ArticleListShell title="Audit" description="Only an admin can open this page." showCreate={false}>
        <p className="text-[13px] text-fg-muted">You do not have permission to read the auth audit log.</p>
      </ArticleListShell>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [total, events] = await Promise.all([
    prisma.authAuditEvent.count(),
    prisma.authAuditEvent.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        identityId: true,
        action: true,
        ip: true,
        userAgent: true,
        createdAt: true,
      },
    }),
  ]);

  const identityIds = [...new Set(events.flatMap((row) => (row.identityId ? [row.identityId] : [])))];
  const identities = identityIds.length
    ? await prisma.identity.findMany({
        where: { id: { in: identityIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailByIdentity = new Map(identities.map((row) => [row.id, row.email]));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + events.length, total);

  return (
    <ArticleListShell
      title="Audit"
      description="Authentication and account events from auth.audit_event."
      showCreate={false}
    >
      <p className="mb-3 text-[12px] text-fg-muted">
        {total === 0 ? "No events yet." : `Showing ${from}–${to} of ${total}.`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              <th className="px-4 py-2 font-semibold">When</th>
              <th className="px-4 py-2 font-semibold">Action</th>
              <th className="px-4 py-2 font-semibold">Account</th>
              <th className="px-4 py-2 font-semibold">IP</th>
              <th className="px-4 py-2 font-semibold">Client</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-fg-muted">
                  No auth events on this page.
                </td>
              </tr>
            ) : (
              events.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0 align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-fg tabular-nums">
                    <time dateTime={row.createdAt.toISOString()}>{formatWhen(row.createdAt)}</time>
                  </td>
                  <td className="px-4 py-2.5 text-fg">{auditActionLabel(row.action)}</td>
                  <td className="px-4 py-2.5 text-fg">
                    {row.identityId ? (emailByIdentity.get(row.identityId) ?? row.identityId) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-muted">
                    {resolveClientIp(row.ip) ?? "—"}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 text-[12px] text-fg-muted" title={row.userAgent ?? undefined}>
                    {shortAgent(row.userAgent)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <nav className="mt-4 flex items-center gap-3 text-[13px]" aria-label="Audit pages">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="font-semibold text-accent hover:underline">
              Newer
            </Link>
          ) : (
            <span className="text-fg-muted">Newer</span>
          )}
          <span className="text-fg-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className="font-semibold text-accent hover:underline">
              Older
            </Link>
          ) : (
            <span className="text-fg-muted">Older</span>
          )}
        </nav>
      ) : null}
    </ArticleListShell>
  );
}

function pageHref(page: number): string {
  return page <= 1 ? "/admin/audit" : `/admin/audit?page=${page}`;
}

function formatWhen(at: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(at) + " UTC";
}

function shortAgent(agent: string | null): string {
  if (!agent) return "—";
  const trimmed = agent.trim();
  if (trimmed.length <= 64) return trimmed;
  return `${trimmed.slice(0, 61)}…`;
}
