import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { AuthFrame, authFieldClass } from "@/components/auth/auth-frame";
import { resetPassword } from "@/lib/auth/actions";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; e?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ResetForm searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetForm({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; e?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const message =
    params.e === "match"
      ? "Those passwords do not match."
      : params.e === "weak"
        ? "Use at least 12 characters, with three of uppercase, lowercase, a digit, and a symbol."
        : params.e === "invalid" || !token
          ? "This reset link is invalid or has expired."
          : null;

  return (
    <AuthFrame title="Choose a new password" lede="This link works once.">
      {token && params.e !== "invalid" ? (
        <form action={resetPassword}>
          <input type="hidden" name="token" value={token} />
          <label className="mt-8 block text-[13px] font-semibold text-fg" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={authFieldClass}
          />
          <label className="mt-4 block text-[13px] font-semibold text-fg" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className={authFieldClass}
          />
          {message ? (
            <p role="alert" className="mt-4 text-[13px] font-medium text-danger">
              {message}
            </p>
          ) : null}
          <Button type="submit" className="mt-6 h-10 w-full">
            Update password
          </Button>
        </form>
      ) : (
        <p role="alert" className="mt-8 text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </AuthFrame>
  );
}
