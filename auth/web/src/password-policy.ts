/** Minimum bar from the security spec. Breach and zxcvbn checks are a later pass. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 128) return "Use 128 characters or fewer.";

  let classes = 0;
  if (/[a-z]/.test(password)) classes += 1;
  if (/[A-Z]/.test(password)) classes += 1;
  if (/\d/.test(password)) classes += 1;
  if (/[^A-Za-z0-9]/.test(password)) classes += 1;
  if (classes < 3) {
    return "Use at least three of uppercase, lowercase, a digit, and a symbol.";
  }
  return null;
}
