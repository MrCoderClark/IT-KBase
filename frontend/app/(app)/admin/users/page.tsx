import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { Button } from "@/components/ui/button";
import { setSignInEnabled, setUserRole } from "@/lib/auth/user-actions";
import { can, ROLES, type Role } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const selectClass =
  "h-8 rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent";

const ROLE_LABEL: Record<Role, string> = {
  reader: "Reader",
  author: "Author",
  reviewer: "Reviewer",
  admin: "Admin",
};

export default function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string }>;
}) {
  return (
    <Suspense fallback={<ArticleListShell title="Users" description="Loading accounts…" showCreate={false}><div /></ArticleListShell>}>
      <UsersPanel searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersPanel({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) {
    return (
      <ArticleListShell title="Users" description="Only an admin can open this page." showCreate={false}>
        <p className="text-[13px] text-fg-muted">You do not have permission to manage accounts.</p>
      </ArticleListShell>
    );
  }

  const params = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, identityId: true },
  });
  const identityIds = users.flatMap((user) => (user.identityId ? [user.identityId] : []));
  const identities = await prisma.identity.findMany({
    where: { id: { in: identityIds } },
    select: { id: true, disabledAt: true },
  });
  const disabled = new Map(identities.map((row) => [row.id, row.disabledAt !== null]));
  const message =
    params.e === "self"
      ? "You cannot change your own access."
      : params.e === "last"
        ? "The last admin has to keep that role, and their sign-in has to stay on."
        : params.e === "missing"
          ? "That account was not found."
          : params.e === "role"
            ? "That role is not valid."
            : params.notice === "role"
              ? "Role updated. That person was signed out."
              : params.notice === "off"
                ? "Sign-in turned off. Their sessions were ended."
                : params.notice === "on"
                  ? "Sign-in turned on."
                  : null;

  return (
    <ArticleListShell
      title="Users"
      description="Change a role or turn sign-in off. A role change signs that person out."
      showCreate={false}
    >
      {message ? (
        <p role="status" className={`mb-4 text-[13px] font-medium ${params.e ? "text-danger" : "text-fg"}`}>
          {message}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold">Role</th>
              <th className="px-4 py-2 font-semibold">Sign-in</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const signInOff = user.identityId ? disabled.get(user.identityId) === true : false;
              const isSelf = user.id === session.userId;
              return (
                <tr key={user.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 align-middle font-semibold text-fg">
                    {user.name}
                    {isSelf ? <span className="ml-2 text-[12px] font-medium text-fg-muted">You</span> : null}
                  </td>
                  <td className="px-4 py-3 align-middle text-fg-muted">{user.email}</td>
                  <td className="px-4 py-3 align-middle">
                    {isSelf ? (
                      <span className="text-fg">{ROLE_LABEL[user.role]}</span>
                    ) : (
                      <form action={setUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <label className="sr-only" htmlFor={`role-${user.id}`}>
                          Role for {user.name}
                        </label>
                        <select id={`role-${user.id}`} name="role" defaultValue={user.role} className={selectClass}>
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="outline" size="sm">
                          Save
                        </Button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <span className="text-fg">{signInOff ? "Off" : "On"}</span>
                      {isSelf || !user.identityId ? null : (
                        <form action={setSignInEnabled}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="enabled" value={signInOff ? "1" : "0"} />
                          <Button type="submit" variant="outline" size="sm">
                            {signInOff ? "Turn on" : "Turn off"}
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ArticleListShell>
  );
}
