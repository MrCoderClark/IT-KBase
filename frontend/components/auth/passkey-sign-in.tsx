"use client";

import { useEffect, useState } from "react";
import { startAuthentication, WebAuthnError } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { beginPasskeyLogin, finishPasskeyLogin } from "@/lib/auth/passkey-actions";

type Started = Awaited<ReturnType<typeof beginPasskeyLogin>>;
type Ready = Extract<Started, { ok: true }>;

const FRESH_MS = 4 * 60 * 1000;
let cached: Ready | null = null;
let cachedAt = 0;
let loading: Promise<Started> | null = null;

function prepare(): Promise<Started> {
  if (cached && Date.now() - cachedAt < FRESH_MS) return Promise.resolve(cached);
  if (loading) return loading;
  loading = beginPasskeyLogin().then((result) => {
    loading = null;
    if (result.ok) {
      cached = result;
      cachedAt = Date.now();
    }
    return result;
  });
  return loading;
}

function takeReady(): Ready | null {
  if (!cached || Date.now() - cachedAt >= FRESH_MS) return null;
  return cached;
}

export function PasskeySignIn({ nextPath }: { nextPath: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void prepare();
  }, []);

  async function signIn() {
    if (typeof window.PublicKeyCredential === "undefined") {
      setError("This browser cannot use a passkey.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      let started: Started | null = takeReady();
      if (!started) started = await prepare();
      if (!started.ok) {
        setError(started.error);
        return;
      }
      const credential = await startAuthentication({ optionsJSON: started.options });
      cached = null;
      const signedIn = await finishPasskeyLogin(credential, nextPath);
      if (!signedIn.ok) {
        setError(signedIn.error);
        void prepare();
        return;
      }
      window.location.assign(signedIn.nextPath);
    } catch (caught) {
      if (caught instanceof WebAuthnError && caught.code === "ERROR_CEREMONY_ABORTED") {
        setError("Sign-in was cancelled.");
      } else if (caught instanceof WebAuthnError && caught.message.includes("not allowed")) {
        setError("Click Sign in with a passkey again so the browser can open the prompt.");
      } else {
        setError("This browser could not use a passkey.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-center text-[12px] text-fg-muted">or</p>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="mt-3 h-10 w-full"
        disabled={pending}
        onClick={() => void signIn()}
      >
        {pending ? "Waiting for the device…" : "Sign in with a passkey"}
      </Button>
    </div>
  );
}
