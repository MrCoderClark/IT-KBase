# 13 — Accessibility

> Automated axe suite in `frontend/e2e/` plus this keyboard-only checklist. Axe covers WCAG 2.x A/AA rule tags (serious/critical must be empty). The checklist records a keyboard-only pass on the main routes.

## Automated suite (Playwright + axe)

From `frontend/` (PowerShell). App on `:3000` or let Playwright start `next dev`. Seeded Joe Clark account required.

```powershell
cd frontend

# First time on a machine
pnpm test:a11y:install

# Full suite — auth once via e2e/auth.setup.ts, then routes in e2e/a11y.spec.ts
pnpm test:a11y

# Single test by title
pnpm exec playwright test e2e/a11y.spec.ts -g "article detail"

# HTML report from the last run
pnpm test:a11y:report
```

Optional env: `PLAYWRIGHT_BASE_URL` (skip starting Next), `PLAYWRIGHT_PORT` (default `3000`).

## Keyboard walkthrough

**Environment:** Chromium or Edge, Windows, seeded Joe Clark account (`TechBase-dev-1`).

**Pass criteria:** Every control below is reachable without a mouse; focus is visible; Escape / Enter behave as noted; no keyboard trap.

**Accent note:** Default light accent is `#1A5AE0` (AA on `--canvas`). Custom admin accents can still fail axe `color-contrast` — treat that as a settings/content issue, not a product regression.

## Routes

### `/login`

1. Tab to Email → Password → Sign in → Forgot password.
2. Enter submits the form from Password.
3. Failed login keeps focus in the form; status message is announced (`role="status"`).

### Home `/` and `/kb`

1. Skip to main content if a skip link exists; otherwise Tab into the sidebar, then the canvas.
2. Sidebar links activate with Enter.
3. On `/kb`, Tab into search and filters; Space/Enter opens selects; table sort headers activate with Enter.
4. Open an article with Enter on its title link.

### Article detail

1. Tab through Edit / Share / overflow without trapping.
2. In-page TOC links move focus/scroll to the section.
3. Callouts and step badges are not required to be focusable; interactive controls inside steps (copy, links) are.

### Article editor (`/kb/.../edit`)

1. Tab order: title → summary → sections → metadata rail → Save / Preview / Publish.
2. TipTap section bodies accept typing after Tab into the editor surface.
3. Dialogs (Publish, Preview, Delete) trap focus until Escape or explicit close; focus returns to the opener.

### Command palette (`Ctrl+K`)

1. Opens from anywhere in the signed-in shell.
2. Arrow keys move the list; Enter navigates; Escape closes and restores focus.

### Admin `/admin/integrations`

1. Tab to Add integration; dialog focus lands on the first field.
2. Escape closes Add / Configure; Remove confirm uses the browser dialog (acceptable for v1).

## Record the pass

When the keyboard walkthrough succeeds, check item 28 in `progress.md` / `Docs/suggested-order.md` with the date and browser used. Axe suite: claim clean only when `pnpm test:a11y` is green.
