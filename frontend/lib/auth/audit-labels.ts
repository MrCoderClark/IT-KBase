/** Human labels for `auth.audit_event.action` values written today. */
const LABELS: Record<string, string> = {
  login_succeeded: "Signed in",
  login_failed: "Sign-in failed",
  login_unknown: "Sign-in failed (unknown email)",
  login_disabled: "Sign-in refused (disabled)",
  login_unverified: "Sign-in refused (unverified)",
  login_rate_limited: "Sign-in rate limited",
  login_mfa_required: "MFA required",
  login_mfa_succeeded: "MFA succeeded",
  login_mfa_failed: "MFA failed",
  login_mfa_recovery: "Signed in with recovery code",
  login_passkey_succeeded: "Signed in with passkey",
  login_passkey_failed: "Passkey sign-in failed",
  logout: "Signed out",
  password_reset: "Password reset completed",
  reset_requested: "Password reset requested",
  reset_rate_limited: "Password reset rate limited",
  reset_disabled: "Password reset refused (disabled)",
  reset_unknown: "Password reset for unknown email",
  verify_requested: "Email verification requested",
  email_verified: "Email verified",
  role_changed: "Role changed",
  sign_in_enabled: "Sign-in turned on",
  sign_in_disabled: "Sign-in turned off",
  user_created: "Account created",
  user_deleted: "Account deleted",
  email_changed: "Email changed",
  name_changed: "Name changed",
  passkey_registered: "Passkey added",
  passkey_removed: "Passkey removed",
  mfa_enabled: "Authenticator enabled",
  mfa_disabled: "Authenticator disabled",
  mfa_recovery_regenerated: "Recovery codes regenerated",
};

export function auditActionLabel(action: string): string {
  return LABELS[action] ?? action.replaceAll("_", " ");
}
