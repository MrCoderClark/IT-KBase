import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { AuthFrame, authFieldClass } from "@/components/auth/auth-frame";
import { requestReset } from "@/lib/auth/actions";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; sent?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ForgotForm searchParams={searchParams} />
    </Suspense>
  );
}

async function ForgotForm({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const message =
    params.sent === "1"
      ? "If that email has an account, a message is on its way."
      : params.e === "2"
        ? "Too many attempts. Wait a few minutes and try again."
        : params.e === "1"
          ? "Enter a valid email address."
          : null;

  return (
    <AuthFrame title="Reset password" lede="We will send a one-time link if the account exists.">
      <form action={requestReset}>
        <label className="mt-8 block text-[13px] font-semibold text-fg" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={authFieldClass}
        />
        {message ? (
          <p role="status" className={`mt-4 text-[13px] font-medium ${params.e ? "text-danger" : "text-fg"}`}>
            {message}
          </p>
        ) : null}
        <Button type="submit" className="mt-6 h-10 w-full">
          Send link
        </Button>
      </form>
    </AuthFrame>
  );
}
