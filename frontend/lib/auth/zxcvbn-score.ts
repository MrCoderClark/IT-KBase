import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommon from "@zxcvbn-ts/language-common";
import * as zxcvbnEn from "@zxcvbn-ts/language-en";

/**
 * Brand / seed / product strings so zxcvbn treats them as known (not novel).
 * Without these, `TechBase-dev-1` scores 4 and slips past the ≥ 3 bar.
 */
const PRODUCT_USER_INPUTS = [
  "techbase",
  "TechBase",
  "TECHBASE",
  "techbase-dev",
  "TechBase-dev",
  "TechBase-dev-1",
  "techbasedev",
  "itkbase",
  "it-kbase",
  "kbase",
  "knowledgebase",
  "knowledge-base",
];

let ready = false;

function ensureOptions(): void {
  if (ready) return;
  zxcvbnOptions.setOptions({
    translations: zxcvbnEn.translations,
    graphs: zxcvbnCommon.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommon.dictionary,
      ...zxcvbnEn.dictionary,
      userInputs: PRODUCT_USER_INPUTS,
    },
  });
  ready = true;
}

/** zxcvbn score 0–4 for `passwordProblem` / reset and admin create. */
export function zxcvbnScore(password: string): number {
  ensureOptions();
  return zxcvbn(password, PRODUCT_USER_INPUTS).score;
}
