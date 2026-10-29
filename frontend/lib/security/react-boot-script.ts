import { createHash } from "node:crypto";

/**
 * React 19 streaming boot script emitted without a CSP nonce under
 * cacheComponents / Suspense (see Next.js #98015). Allowed by sha256.
 */
export const REACT_RT_BOOT_SCRIPT =
  "requestAnimationFrame(function(){$RT=performance.now()});";

export const REACT_RT_BOOT_SCRIPT_SHA256 =
  `'sha256-${createHash("sha256").update(REACT_RT_BOOT_SCRIPT, "utf8").digest("base64")}'`;
