import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.2 AA tags axe supports today for automated checks. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

export const AUTH_STATE_PATH = path.join(__dirname, ".auth", "user.json");

export async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
  const serious = results.violations.filter(
    (row) => row.impact === "critical" || row.impact === "serious",
  );
  const summary = serious
    .map((row) => `${row.id} (${row.impact}): ${row.help} [${row.nodes.length} node(s)]`)
    .join("\n");
  expect(serious, `${label} axe serious/critical:\n${summary}`).toEqual([]);
}

export async function signInAsJoe(page: Page): Promise<void> {
  await page.goto("/login");
  // Already signed in (cookie from a prior run / storageState).
  if (!page.url().includes("/login")) return;

  await page.locator("#email").fill("joe.clark@techbase.local");
  await page.locator("#password").fill("TechBase-dev-1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  } catch {
    const body = await page.locator("body").innerText();
    if (body.includes("Too many attempts")) {
      throw new Error(
        "Sign-in rate limited. Wait a few minutes, then re-run. Auth now runs once via e2e/auth.setup.ts.",
      );
    }
    throw new Error(`Sign-in did not leave /login. Page says:\n${body.slice(0, 400)}`);
  }
}
