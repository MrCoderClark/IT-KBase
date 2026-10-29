"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { beginPasskeyRegistration, finishPasskeyRegistration } from "@/lib/auth/passkey-actions";

type Started = Awaited<ReturnType<typeof beginPasskeyRegistration>>;
type Ready = Extract<Started, { ok: true }>;

const FRESH_MS = 4 * 60 * 1000;
let cached: Ready | null = null;
let cachedAt = 0;
let loading: Promise<Started> | null = null;

function prepare(): Promise<Started> {
  if (cached && Date.now() - cachedAt < FRESH_MS) return Promise.resolve(cached);
  if (loading) return loading;
  loading = beginPasskeyRegistration().then((result) => {
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

export function AddPasskey() {
  const router = useRouter();
  const [name, setName] = useState("This device");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void prepare();
  }, []);

  async function add() {
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
      const credential = await startRegistration({ optionsJSON: started.options });
      cached = null;
      const saved = await finishPasskeyRegistration(credential, name);
      if (!saved.ok) {
        setError(saved.error);
        void prepare();
        return;
      }
      router.push("/account/security");
      router.refresh();
    } catch (caught) {
      if (caught instanceof WebAuthnError && caught.code === "ERROR_CEREMONY_ABORTED") {
        setError("Passkey setup was cancelled.");
      } else if (caught instanceof WebAuthnError && caught.message.includes("not allowed")) {
        setError("Click Add a passkey again so the browser can open the prompt.");
      } else if (caught instanceof WebAuthnError && caught.message) {
        setError(caught.message);
      } else {
        setError("This browser could not create a passkey.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <label className="block text-[13px] font-semibold text-fg" htmlFor="passkey-name">
        Name
      </label>
      <input
        id="passkey-name"
        value={name}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        className="mt-1.5 h-10 w-full max-w-xs rounded-sm border border-border-strong bg-surface px-3 text-[14px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {error ? (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Button type="button" className="mt-4" disabled={pending} onClick={() => void add()}>
        {pending ? "Waiting for the device…" : "Add a passkey"}
      </Button>
    </div>
  );
}
