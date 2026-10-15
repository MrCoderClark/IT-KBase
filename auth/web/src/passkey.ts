/**
 * A synced passkey often stays at 0. A counter that does not move forward after either side
 * has left 0 means the authenticator was cloned or the assertion was replayed.
 */
export function signatureCounterRegressed(stored: number, next: number): boolean {
  return (next > 0 || stored > 0) && next <= stored;
}

/** Display name stored with the credential. Empty input becomes the default. */
export function passkeyName(raw: string): string {
  const name = raw.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
  return name.length > 0 ? name : "This device";
}
