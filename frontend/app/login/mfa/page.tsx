import { Suspense } from "react";
import { AuthFrame, authFieldClass } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { submitMfa } from "@/lib/auth/mfa-actions";
import { safeNextPath } from "../../../../auth/web/src/session";

export default function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; next?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <MfaForm searchParams={searchParams} />
    </Suspense>
  );
}

async function MfaForm({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const message =
    params.e === "2"
      ? "Too many attempts. Wait a few minutes and try again."
      : params.e === "1"
        ? "That code is not valid."
        : null;

  return (
    <AuthFrame
      title="Authenticator code"
      lede="Enter the 6-digit code from your app, or a recovery code."
    >
      <form action={submitMfa} className="mt-8">
        <input type="hidden" name="next" value={nextPath} />
        <label className="block text-[13px] font-semibold text-fg" htmlFor="code">
          Code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          className={authFieldClass}
        />
        {message ? (
          <p role="status" className="mt-4 text-[13px] font-medium text-danger">
            {message}
          </p>
        ) : null}
        <Button type="submit" className="mt-6 h-10 w-full">
          Continue
        </Button>
      </form>
    </AuthFrame>
  );
}
