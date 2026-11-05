/**
 * Pulls the "exact" tokens out of a question (spec 20 §5.2 step 1, A4): error
 * codes, KB IDs, Oracle-style codes, Event IDs, and PowerShell cmdlets. A chunk
 * that contains one of these is boosted in the fused ranking so a query like
 * "Autopilot 0x80180014" lands on the section that quotes that code, not just
 * the semantically-nearest prose.
 *
 * Pure and DB-free so it unit-tests under `tsx --test`.
 */

// The `(?<![\w-])…(?![\w-])` guards stop a pattern from matching inside a
// larger token — e.g. the vendor-code rule must not pull "IT-1042" out of
// "KB-IT-1042".
const PATTERNS: RegExp[] = [
  /\b0x[0-9a-f]{3,}\b/gi, // hex error codes, e.g. 0x80180014
  /\bKB-[A-Z]{2,}-\d+\b/gi, // TechBase article refs, e.g. KB-IT-1042
  /\bKB\d{5,}\b/gi, // Windows update KBs, e.g. KB5034441
  /(?<![\w-])[A-Z]{2,5}-\d{3,6}(?![\w-])/g, // Oracle/vendor codes, e.g. ORA-12541
  /\bEvent ID \d+\b/gi, // Windows event IDs
  /(?<![\w-])[A-Z][a-z]+-[A-Z][a-zA-Z0-9]+(?![\w-])/g, // PowerShell cmdlets, e.g. Get-WindowsAutopilotInfo
];

/** Distinct exact tokens found in the question, preserving first-seen order. */
export function extractExactTokens(question: string): string[] {
  const seen = new Map<string, string>(); // lowercased key → original casing
  for (const pattern of PATTERNS) {
    for (const match of question.matchAll(pattern)) {
      const token = match[0].trim();
      const key = token.toLowerCase();
      if (!seen.has(key)) seen.set(key, token);
    }
  }
  return [...seen.values()];
}
