import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "../../../auth/web/src/session";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/auth/actions";
import { DEV_ACCOUNT_PASSWORD } from "@/lib/auth/dev-password";
import { getSession } from "@/lib/auth/session";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; next?: string; notice?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; next?: string; notice?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const message =
    params.e === "2"
      ? "Too many attempts. Wait a few minutes and try again."
      : params.e === "1"
        ? "Email or password is incorrect."
        : params.notice === "reset"
          ? "Password updated. Sign in with the new password."
          : params.notice === "verified"
            ? "Email verified. You can sign in."
            : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
      <aside
        className="flex flex-col justify-between px-8 py-10 text-white"
        style={{
          background: "linear-gradient(180deg, #0B1220 0%, #0F172A 100%)",
        }}
      >
        <div>
          <p className="text-[13px] font-semibold tracking-wide text-white/70">TechBase</p>
          <h1 className="mt-6 text-[28px] leading-8 font-semibold">IT Knowledge Hub</h1>
          <p className="mt-3 max-w-xs text-[14px] leading-6 text-white/70">
            Sign in to read and edit runbooks.
          </p>
        </div>
        <p className="text-[12px] text-white/50">Internal use</p>
      </aside>

      <main className="flex items-center justify-center bg-canvas px-6 py-16">
        <form action={login} className="w-full max-w-sm">
          <h2 className="text-[20px] font-semibold text-fg">Sign in</h2>
          <p className="mt-1 text-[14px] text-fg-muted">Use your TechBase account.</p>

          <input type="hidden" name="next" value={nextPath} />

          <label className="mt-8 block text-[13px] font-semibold text-fg" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="mt-1.5 h-10 w-full rounded-sm border border-border-strong bg-surface px-3 text-[14px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />

          <label className="mt-4 block text-[13px] font-semibold text-fg" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1.5 h-10 w-full rounded-sm border border-border-strong bg-surface px-3 text-[14px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />

          {message ? (
            <p
              role="status"
              className={`mt-4 text-[13px] font-medium ${params.e ? "text-danger" : "text-fg"}`}
            >
              {message}
            </p>
          ) : null}

          <Button type="submit" className="mt-6 h-10 w-full">
            Sign in
          </Button>

          <p className="mt-4 text-[13px]">
            <Link href="/forgot-password" className="font-semibold text-accent hover:underline">
              Forgot password?
            </Link>
          </p>

          {process.env.NODE_ENV === "development" ? (
            <p className="mt-6 text-[12px] leading-5 text-fg-muted">
              Seeded accounts use <span className="font-mono">{DEV_ACCOUNT_PASSWORD}</span>. Run
              the database seed once so those accounts can sign in.
            </p>
          ) : null}
        </form>
      </main>
    </div>
  );
}
