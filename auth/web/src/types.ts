export type IdentityRecord = {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: Date | null;
  disabledAt: Date | null;
};

export type SessionRecord = {
  id: string;
  identityId: string;
  expiresAt: Date;
  idleAt: Date;
  revokedAt: Date | null;
};

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(encoded: string, plain: string): Promise<boolean>;
}

export interface AuthStore {
  countAttempts(key: string, since: Date): Promise<number>;
  recordAttempt(key: string, at: Date): Promise<void>;
  findIdentityByEmail(email: string): Promise<IdentityRecord | null>;
  createSession(input: {
    identityId: string;
    secretHash: string;
    expiresAt: Date;
    idleAt: Date;
    userAgent: string | null;
  }): Promise<void>;
  findSessionBySecretHash(secretHash: string): Promise<SessionRecord | null>;
  touchSession(id: string, idleAt: Date): Promise<void>;
  revokeSession(id: string, at: Date): Promise<void>;
  saveEmailToken(input: {
    identityId: string;
    purpose: "reset_password" | "verify_email";
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findEmailToken(tokenHash: string): Promise<{
    id: string;
    identityId: string;
    purpose: string;
    expiresAt: Date;
    usedAt: Date | null;
  } | null>;
  consumeEmailToken(id: string, at: Date): Promise<boolean>;
  setPasswordAndRevokeSessions(identityId: string, passwordHash: string, at: Date): Promise<void>;
  markEmailVerified(identityId: string, at: Date): Promise<void>;
  audit(event: {
    identityId: string | null;
    action: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void>;
}

export type LoginSuccess = {
  ok: true;
  secret: string;
  identityId: string;
};

export type LoginFailure = {
  ok: false;
  error: "invalid" | "rate_limited";
};

export type LoginResult = LoginSuccess | LoginFailure;
