import { test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";

const ARTICLE = "/kb/windows-11-resetting-local-administrator-password";

test.describe("axe-core on main routes", () => {
  test("login is clean", async ({ page }) => {
    // Anonymous — clear any storageState from the signed-in project.
    await page.context().clearCookies();
    await page.goto("/login");
    await expectNoAxeViolations(page, "/login");
  });

  test("home is clean", async ({ page }) => {
    await page.goto("/");
    await expectNoAxeViolations(page, "/");
  });

  test("kb list is clean", async ({ page }) => {
    await page.goto("/kb");
    await expectNoAxeViolations(page, "/kb");
  });

  test("article detail is clean", async ({ page }) => {
    await page.goto(ARTICLE);
    await expectNoAxeViolations(page, ARTICLE);
  });

  test("article editor is clean", async ({ page }) => {
    await page.goto(`${ARTICLE}/edit`);
    await expectNoAxeViolations(page, `${ARTICLE}/edit`);
  });

  test("admin integrations is clean", async ({ page }) => {
    await page.goto("/admin/integrations");
    await expectNoAxeViolations(page, "/admin/integrations");
  });
});
