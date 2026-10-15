import { Suspense } from "react";
import { qrSvg } from "../../../../../auth/web/src/qr";
import { decryptTotpSecret } from "../../../../../auth/web/src/mfa-secret";
import { otpauthUri } from "../../../../../auth/web/src/totp";
import { AddPasskey } from "@/components/auth/add-passkey";
import { Button } from "@/components/ui/button";
import {
  beginTotp,
  confirmTotpEnrollment,
  disableTotp,
  dismissRecoveryCodes,
  regenerateRecoveryCodes,
} from "@/lib/auth/mfa-actions";
import { removePasskey } from "@/lib/auth/passkey-actions";
import { listPasskeys } from "@/lib/auth/passkey-store";
import { MFA_ISSUER, mfaKey } from "@/lib/auth/mfa-key";
import { findTotp } from "@/lib/auth/mfa-store";
import { getSession, readRecoveryCookie } from "@/lib/auth/session";

const fieldClass =
  "mt-1.5 h-10 w-full max-w-xs rounded-sm border border-border-strong bg-surface px-3 text-[14px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string; codes?: string }>;
}) {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-[13px] text-fg-subtle">Loading…</div>}>
      <SecurityPanel searchParams={searchParams} />
    </Suspense>
  );
}

async function SecurityPanel({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; notice?: string; codes?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const params = await searchParams;
  const passkeys = await listPasskeys(session.identityId);
  const key = mfaKey();
  const totp = await findTotp(session.identityId);
  const confirmed = totp?.confirmedAt != null;
  let freshCodes: string[] = [];
  if (params.codes === "1" && key) {
    const payload = await readRecoveryCookie();
    if (payload) {
      try {
        const parsed: unknown = JSON.parse(decryptTotpSecret(payload, key));
        if (Array.isArray(parsed)) freshCodes = parsed.filter((item) => typeof item === "string");
      } catch {
        freshCodes = [];
      }
    }
  }

  let pending: { secret: string; svg: string | null } | null = null;
  if (totp && !confirmed && key) {
    try {
      const secret = decryptTotpSecret(totp.secretCipher, key);
      let svg: string | null = null;
      try {
        svg = qrSvg(otpauthUri({ issuer: MFA_ISSUER, account: session.email, secret }));
      } catch {
        svg = null;
      }
      pending = { secret, svg };
    } catch {
      pending = null;
    }
  }

  const message =
    params.e === "key"
      ? "Authenticator setup needs AUTH_MFA_KEY on the server."
      : params.e === "code"
        ? "That code is not valid."
        : params.notice === "off"
          ? "Authenticator turned off. Other sessions were signed out."
          : null;

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-8">
      <h1 className="text-[22px] leading-7 font-bold tracking-tight text-fg">Security</h1>
      <p className="mt-1 text-[13px] text-fg-muted">
        An authenticator app is optional. Password sign-in stays available until you turn it on.
      </p>
      {message ? (
        <p role="status" className="mt-4 text-[13px] font-medium text-fg">
          {message}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[15px] font-semibold text-fg">Passkeys</h2>
        <p className="mt-1 text-[13px] leading-5 text-fg-muted">
          Windows Hello, a phone, or a security key can sign in on its own. Removing one leaves
          the password and the authenticator as they are.
        </p>
        {passkeys.length === 0 ? (
          <p className="mt-3 text-[13px] text-fg-muted">No passkeys yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[13px] text-fg">{passkey.name}</span>
                <form action={removePasskey}>
                  <input type="hidden" name="id" value={passkey.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddPasskey />
      </section>

      {freshCodes.length > 0 ? (
        <section className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-[15px] font-semibold text-fg">Recovery codes</h2>
          <p className="mt-1 text-[13px] leading-5 text-fg-muted">
            Save these now. Each code works once, and this list is not shown again.
          </p>
          <ul className="mt-3 grid gap-1 font-mono text-[13px] text-fg">
            {freshCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <form action={dismissRecoveryCodes} className="mt-4">
            <Button type="submit" variant="outline">
              I&apos;ve saved these codes
            </Button>
          </form>
        </section>
      ) : null}

      {!confirmed && !pending ? (
        <form action={beginTotp} className="mt-6">
          <Button type="submit">Set up authenticator</Button>
        </form>
      ) : null}

      {pending ? (
        <section className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-[15px] font-semibold text-fg">Scan this code</h2>
          <p className="mt-1 text-[13px] leading-5 text-fg-muted">
            Open your authenticator app and scan the code. Then enter the 6-digit code it shows.
          </p>
          {pending.svg ? (
            <div
              className="mt-4 w-72 max-w-full bg-white p-3"
              role="img"
              aria-label="QR code for your authenticator app"
              dangerouslySetInnerHTML={{ __html: pending.svg }}
            />
          ) : null}
          <details className="mt-4">
            <summary className="cursor-pointer text-[12px] font-medium text-fg-muted">
              Can&apos;t scan? Show the setup key
            </summary>
            <p className="mt-2 font-mono text-[13px] break-all text-fg">{groupSecret(pending.secret)}</p>
          </details>
          <form action={confirmTotpEnrollment} className="mt-4">
            <label className="block text-[13px] font-semibold text-fg" htmlFor="confirm-code">
              Code
            </label>
            <input id="confirm-code" name="code" inputMode="numeric" required className={fieldClass} />
            <Button type="submit" className="mt-4">
              Confirm and show recovery codes
            </Button>
          </form>
        </section>
      ) : null}

      {confirmed ? (
        <section className="mt-6 space-y-6">
          <p className="text-[13px] text-fg">Authenticator is on for {session.email}.</p>
          <form action={regenerateRecoveryCodes} className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-[15px] font-semibold text-fg">New recovery codes</h2>
            <p className="mt-1 text-[13px] leading-5 text-fg-muted">
              This replaces the unused codes and signs out every other session.
            </p>
            <label className="mt-3 block text-[13px] font-semibold text-fg" htmlFor="regen-code">
              Current code
            </label>
            <input id="regen-code" name="code" required className={fieldClass} />
            <Button type="submit" variant="outline" className="mt-4">
              Generate codes
            </Button>
          </form>
          <form action={disableTotp} className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-[15px] font-semibold text-fg">Turn off authenticator</h2>
            <label className="mt-3 block text-[13px] font-semibold text-fg" htmlFor="disable-code">
              Current code
            </label>
            <input id="disable-code" name="code" required className={fieldClass} />
            <Button type="submit" variant="outline" className="mt-4">
              Turn off
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
