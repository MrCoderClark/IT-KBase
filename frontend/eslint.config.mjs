import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenAPI output — do not lint generated clients.
    "lib/api/generated/**",
  ]),
  {
    rules: {
      // Latest-value refs updated during render are a documented React pattern
      // (autosave / beforeunload). The compiler rule flags them as errors.
      "react-hooks/refs": "off",
      // Search debounce, localStorage hydrate, and prop→state sync for DnD trees
      // set state from effects on purpose; rewrite later rather than block CI.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
