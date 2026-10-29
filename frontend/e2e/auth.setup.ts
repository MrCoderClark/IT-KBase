import { test as setup } from "@playwright/test";
import { AUTH_STATE_PATH, signInAsJoe } from "./a11y";

setup("authenticate as Joe", async ({ page }) => {
  await signInAsJoe(page);
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
