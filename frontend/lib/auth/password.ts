import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "../../../auth/web/src/types";

/** Argon2id parameters from ADR 0001. OWASP minimum: 19 MiB, 2 iterations, parallelism 1. */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const passwordHasher: PasswordHasher = {
  hash(plain: string) {
    return hash(plain, OPTIONS);
  },
  verify(encoded: string, plain: string) {
    return verify(encoded, plain);
  },
};
