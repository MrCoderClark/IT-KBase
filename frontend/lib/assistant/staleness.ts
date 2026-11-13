/**
 * Staleness triage (spec 20 §3.3 C3), deterministic core. Pure functions over an
 * article's age and text — no model call, no backend. `stalenessInfo` decides
 * whether a published article is overdue for review (12+ months since its last
 * update); `outdatedReferences` scans its text for terms that usually signal an
 * out-of-date article (retired products, renamed services, end-of-life OS). Both
 * are suggestions for a reviewer; nothing mutates the article.
 *
 * The LLM "propose an update draft" half of C3 is a later slice that reuses the
 * drafter — this slice is the triage only.
 */

export const STALE_AFTER_DAYS = 365;

export interface Staleness {
  /** True once the article is overdue for review. */
  stale: boolean;
  days: number;
  /** Whole months since the last update, for display. */
  months: number;
}

export function stalenessInfo(updatedAt: Date, now: Date): Staleness {
  const days = Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000));
  return { stale: days >= STALE_AFTER_DAYS, days, months: Math.floor(days / 30) };
}

export interface OutdatedMatch {
  /** Stable key (same as label) for rendering. */
  id: string;
  /** The dated term found, e.g. "Azure AD". */
  label: string;
  /** What a reviewer should do about it. */
  suggest: string;
}

interface OutdatedPattern {
  label: string;
  /** Tested whole-text; no `g` flag so there is no shared lastIndex to reset. */
  re: RegExp;
  suggest: string;
}

/**
 * Conservative, high-signal terms. Deliberately specific so a modern article
 * that merely mentions "Windows" or "server" does not trip them.
 */
export const OUTDATED_PATTERNS: OutdatedPattern[] = [
  {
    label: "Windows 10",
    re: /\bWindows 10\b/i,
    suggest: "Confirm the steps still apply on Windows 11, and note any 24H2 differences.",
  },
  {
    label: "Windows 7",
    re: /\bWindows 7\b/i,
    suggest: "Windows 7 is end-of-life — confirm this targets a supported client.",
  },
  {
    label: "Internet Explorer",
    re: /\bInternet Explorer\b|\bIE ?11\b/i,
    suggest: "Internet Explorer is retired — point to Microsoft Edge (IE mode if required).",
  },
  {
    label: "Azure AD",
    re: /\bAzure Active Directory\b|\bAzure AD\b/i,
    suggest: "Rename to Microsoft Entra ID.",
  },
  {
    label: "Windows Server 2012",
    re: /\bWindows Server 2012(?: R2)?\b/i,
    suggest: "Server 2012 / 2012 R2 is end-of-life — recommend a supported release.",
  },
  {
    label: "Windows Server 2008",
    re: /\bWindows Server 2008(?: R2)?\b/i,
    suggest: "Server 2008 / 2008 R2 is end-of-life — recommend a supported release.",
  },
  {
    label: "Skype for Business",
    re: /\bSkype for Business\b/i,
    suggest: "Skype for Business moved to Microsoft Teams — update the references.",
  },
  {
    label: "Basic authentication",
    re: /\bbasic auth(?:entication)?\b/i,
    suggest: "Basic auth is deprecated in Exchange Online — recommend modern auth / OAuth.",
  },
  {
    label: "TLS 1.0 / 1.1",
    re: /\bTLS 1\.[01]\b/i,
    suggest: "TLS 1.0 / 1.1 are deprecated — require TLS 1.2 or later.",
  },
];

/** Dated terms present in the text, one per pattern (deduped by label). */
export function outdatedReferences(text: string): OutdatedMatch[] {
  const matches: OutdatedMatch[] = [];
  for (const pattern of OUTDATED_PATTERNS) {
    if (pattern.re.test(text)) {
      matches.push({ id: pattern.label, label: pattern.label, suggest: pattern.suggest });
    }
  }
  return matches;
}
