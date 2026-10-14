import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { AuthFrame } from "@/components/auth/auth-frame";
import { verifyEmail } from "@/lib/auth/actions";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; e?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <VerifyForm searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyForm({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; e?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const invalid = params.e === "invalid" || !token;

  return (
    <AuthFrame title="Verify email" lede="Confirm this address so the account can sign in.">
      {invalid ? (
        <p role="alert" className="mt-8 text-[13px] font-medium text-danger">
          This verification link is invalid or has expired.
        </p>
      ) : (
        <form action={verifyEmail}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="mt-8 h-10 w-full">
            Verify email
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
