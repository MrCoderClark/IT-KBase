import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { Button } from "@/components/ui/button";
import { createUser, deleteUser, setSignInEnabled, setUserRole, updateUserProfile } from "@/lib/auth/user-actions";
import { can, ROLES, type Role } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const fieldClass =
  "h-8 w-full rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent";

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

function notice(code: string | undefined, error: string | undefined): string | null {
  if (error === "self") return "You cannot change your own access or delete your account.";
  if (error === "last") return "The last admin has to keep that role, and their account has to stay.";
  if (error === "missing") return "That account was not found.";
  if (error === "role") return "That role is not valid.";
  if (error === "name") return "Name must be 2 to 80 characters.";
  if (error === "email") return "Enter an email like ada@contoso.com.";
  if (error === "taken") return "That email is already in use.";
  if (error === "match") return "The passwords do not match.";
  if (error === "password") return "Use at least 12 characters, with three of uppercase, lowercase, a digit, and a symbol.";
  if (error === "confirm") return "Type that person's current email to delete the account.";
  if (code === "role") return "Role updated. That person was signed out.";
  if (code === "off") return "Sign-in turned off. Their sessions were ended.";
  if (code === "on") return "Sign-in turned on.";
  if (code === "created") return "Account created. They can sign in with that password.";
  if (code === "name") return "Name saved.";
  if (code === "email") return "Email saved. That person was signed out.";
  if (code === "deleted") return "Account deleted. Their articles now list you as the author.";
  return null;
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
  const message = notice(params.notice, params.e);

  return (
    <ArticleListShell
      title="Users"
      description="Add an account, edit a name or email, change a role, turn sign-in off, or delete."
      showCreate={false}
    >
      {message ? (
        <p role="status" className={`mb-4 text-[13px] font-medium ${params.e ? "text-danger" : "text-fg"}`}>
          {message}
        </p>
      ) : null}

      <form action={createUser} className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <h2 className="text-[13px] font-semibold text-fg sm:col-span-2">Add an account</h2>
        <label className="space-y-1 text-[12px] text-fg-muted">
          Name
          <input name="name" required maxLength={80} autoComplete="off" className={fieldClass} />
        </label>
        <label className="space-y-1 text-[12px] text-fg-muted">
          Email
          <input name="email" type="email" required autoComplete="off" className={fieldClass} />
        </label>
        <label className="space-y-1 text-[12px] text-fg-muted">
          Role
          <select name="role" defaultValue="author" className={fieldClass}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[12px] text-fg-muted">
          Password
          <input name="password" type="password" required autoComplete="new-password" className={fieldClass} />
        </label>
        <label className="space-y-1 text-[12px] text-fg-muted">
          Confirm password
          <input name="confirmPassword" type="password" required autoComplete="new-password" className={fieldClass} />
        </label>
        <div className="flex items-end">
          <Button type="submit">Add account</Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              <th className="px-4 py-2 font-semibold">Name and email</th>
              <th className="px-4 py-2 font-semibold">Role</th>
              <th className="px-4 py-2 font-semibold">Sign-in</th>
              <th className="px-4 py-2 font-semibold">Delete</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const signInOff = user.identityId ? disabled.get(user.identityId) === true : false;
              const isSelf = user.id === session.userId;
              return (
                <tr key={user.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <form action={updateUserProfile} className="flex flex-col gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <label className="sr-only" htmlFor={`name-${user.id}`}>
                        Name for {user.name}
                      </label>
                      <input id={`name-${user.id}`} name="name" defaultValue={user.name} required maxLength={80} className={fieldClass} />
                      <label className="sr-only" htmlFor={`email-${user.id}`}>
                        Email for {user.name}
                      </label>
                      <input
                        id={`email-${user.id}`}
                        name="email"
                        type="email"
                        defaultValue={user.email}
                        required
                        className={fieldClass}
                      />
                      <div>
                        <Button type="submit" variant="outline" size="sm">
                          Save details
                        </Button>
                        {isSelf ? <span className="ml-2 text-[12px] text-fg-muted">You</span> : null}
                      </div>
                    </form>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {isSelf ? (
                      <span className="text-fg">{ROLE_LABEL[user.role]}</span>
                    ) : (
                      <form action={setUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <label className="sr-only" htmlFor={`role-${user.id}`}>
                          Role for {user.name}
                        </label>
                        <select id={`role-${user.id}`} name="role" defaultValue={user.role} className={fieldClass}>
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
                  <td className="px-4 py-3 align-top">
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
                  <td className="px-4 py-3 align-top">
                    {isSelf ? (
                      <span className="text-[12px] text-fg-muted">Your account stays</span>
                    ) : (
                      <form action={deleteUser} className="flex flex-col gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <label className="sr-only" htmlFor={`delete-${user.id}`}>
                          Type {user.email} to delete
                        </label>
                        <input
                          id={`delete-${user.id}`}
                          name="confirmEmail"
                          type="email"
                          placeholder={user.email}
                          autoComplete="off"
                          className={fieldClass}
                        />
                        <Button type="submit" variant="destructive" size="sm">
                          Delete
                        </Button>
                      </form>
                    )}
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
