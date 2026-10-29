/**
 * Lighthouse gate for the article read view (suggested-order item 29).
 *
 * Primary gate (default): anonymous public article — no app shell.
 *   Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95
 *
 * Secondary (optional): signed-in shell via LIGHTHOUSE_MODE=signed-in.
 *   Reported for info; does not fail the gate (shell TBT is a follow-up).
 *
 * Prefer production (`pnpm build` then `pnpm start`). Seed the Windows 11
 * admin-password article as visibility=public (or run the SQL in 14-lighthouse.md).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");

const BASE =
  process.env.LIGHTHOUSE_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3000";
const ARTICLE_PATH =
  process.env.LIGHTHOUSE_PATH ??
  "/kb/windows-11-resetting-local-administrator-password";
const MODE = (process.env.LIGHTHOUSE_MODE ?? "public").toLowerCase();

const GATE_THRESHOLDS = {
  performance: 90,
  accessibility: 95,
  "best-practices": 95,
};

const AUTH_STATE = path.join(frontendRoot, "e2e", ".auth", "user.json");
const OUT_DIR = path.join(frontendRoot, "lighthouse-report");

function cookieHeaderFromStorageState(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${path.relative(frontendRoot, filePath)}. Run:\n` +
        `  pnpm test:lighthouse:auth\n` +
        `with the app reachable at ${BASE}`,
    );
  }
  const state = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const cookies = Array.isArray(state.cookies) ? state.cookies : [];
  if (cookies.length === 0) {
    throw new Error(`No cookies in ${filePath}; re-run Playwright auth setup.`);
  }
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function score100(category) {
  if (!category || typeof category.score !== "number") return null;
  return Math.round(category.score * 100);
}

async function runLighthouse(url, { cookie } = {}) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: ["json", "html"],
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices"],
      formFactor: "desktop",
      screenEmulation: { disabled: true },
      ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
    });
    if (!result?.lhr) {
      throw new Error("Lighthouse returned no result (is the app up at " + BASE + "?)");
    }
    return result;
  } finally {
    await chrome.kill();
  }
}

function writeReports(prefix, lhr, report) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(OUT_DIR, `${prefix}-${stamp}.json`);
  const htmlPath = path.join(OUT_DIR, `${prefix}-${stamp}.html`);
  const reports = Array.isArray(report) ? report : [report];
  const html =
    reports.find((row) => typeof row === "string" && row.includes("<html")) ?? reports[1] ?? "";
  fs.writeFileSync(jsonPath, JSON.stringify(lhr, null, 2));
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(path.join(OUT_DIR, `latest-${prefix}.html`), html);
  fs.writeFileSync(path.join(OUT_DIR, `latest-${prefix}.json`), JSON.stringify(lhr, null, 2));
  // Keep legacy names pointing at the gate run
  if (prefix === "public") {
    fs.writeFileSync(path.join(OUT_DIR, "latest.html"), html);
    fs.writeFileSync(path.join(OUT_DIR, "latest.json"), JSON.stringify(lhr, null, 2));
  }
  return htmlPath;
}

function printScores(label, lhr, thresholds, { enforce }) {
  console.log(`\n${label}`);
  const failures = [];
  for (const [id, min] of Object.entries(thresholds)) {
    const value = score100(lhr.categories[id]);
    const pad = id.padEnd(16);
    if (value == null) {
      failures.push(`${id}: missing category`);
      console.log(`  ${pad}  — (missing)`);
      continue;
    }
    const mark = value >= min ? "ok" : enforce ? "FAIL" : "low";
    console.log(`  ${pad}  ${String(value).padStart(3)}  (need ≥ ${min})  ${mark}`);
    if (value < min) failures.push(`${id}: ${value} < ${min}`);
  }
  if (lhr.runtimeError?.message) {
    failures.push(`runtimeError: ${lhr.runtimeError.message}`);
  }
  return failures;
}

async function main() {
  const url = new URL(ARTICLE_PATH, BASE).toString();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // --- Primary gate: anonymous public article (proxy rewrites /kb → /p) ---
  console.log(`Mode: public (gate)`);
  console.log(`URL:  ${url} (no session cookie)`);
  const publicRun = await runLighthouse(url);
  const publicHtml = writeReports("public", publicRun.lhr, publicRun.report);
  console.log(`Report: ${path.relative(frontendRoot, publicHtml)}`);

  const finalUrl = publicRun.lhr.finalDisplayedUrl || publicRun.lhr.requestedUrl;
  if (finalUrl.includes("/login")) {
    console.error(
      "\nLanded on /login — article is not publicly readable.\n" +
        "Mark it public, then retry:\n" +
        "  pnpm exec prisma db seed\n" +
        "or SQL in Docs/specs/14-lighthouse.md",
    );
    process.exitCode = 1;
    return;
  }

  const gateFailures = printScores("Public article (gate)", publicRun.lhr, GATE_THRESHOLDS, {
    enforce: true,
  });

  // --- Optional signed-in shell (informational) ---
  if (MODE === "signed-in" || MODE === "both") {
    const cookie = cookieHeaderFromStorageState(AUTH_STATE);
    console.log(`\nMode: signed-in (informational, not gated)`);
    const signedRun = await runLighthouse(url, { cookie });
    const signedHtml = writeReports("signed-in", signedRun.lhr, signedRun.report);
    console.log(`Report: ${path.relative(frontendRoot, signedHtml)}`);
    printScores("Signed-in shell (info)", signedRun.lhr, GATE_THRESHOLDS, { enforce: false });
    console.log("  (Shell TBT is tracked separately; does not fail this gate.)");
  }

  if (gateFailures.length) {
    console.error("\nLighthouse gate failed:\n  - " + gateFailures.join("\n  - "));
    process.exitCode = 1;
  } else {
    console.log("\nLighthouse gate passed (public article).");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
