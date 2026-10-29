import { expect, test, type Page } from "@playwright/test";

const ARTICLE = "/kb/windows-11-resetting-local-administrator-password";

/** Kill motion so snapshot diffs stay stable across runs. */
async function stabilize(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function waitForArticleChrome(page: Page): Promise<void> {
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible" });
  await page.locator("main").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
}

test.describe("article visual snapshots", () => {
  test.describe("public", () => {
    // Fresh anonymous context — avoids clearCookies mid-run tripping app-layout redirects on /
    test.use({ storageState: { cookies: [], origins: [] } });

    test("public article (no shell)", async ({ page }) => {
      await page.goto(ARTICLE);
      await expect(page).not.toHaveURL(/\/login/);
      await stabilize(page);
      await waitForArticleChrome(page);

      await expect(page).toHaveScreenshot("article-public.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  });

  test.describe("signed-in", () => {
    test("signed-in article (app shell)", async ({ page }) => {
      await page.goto(ARTICLE);
      await expect(page).not.toHaveURL(/\/login/);
      await stabilize(page);
      await waitForArticleChrome(page);
      await page.getByRole("navigation").first().waitFor({ state: "visible" });

      await expect(page).toHaveScreenshot("article-signed-in.png", {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  });
});
