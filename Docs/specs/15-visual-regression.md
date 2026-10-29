# 15 — Visual regression (article view)

> Gate for suggested-order item 30. Playwright screenshot baselines for the article read view.

## What we compare

| Snapshot | Session | Notes |
|----------|---------|-------|
| `article-public.png` | Anonymous | Public article chrome (no sidebar). Slug must be `visibility: public`. |
| `article-signed-in.png` | Joe Clark | Full app shell + article. |

Baselines live under `frontend/e2e/visual.spec.ts-snapshots/` (committed). The PNG mock in `Docs/mocks/` remains the **design** north star; this suite catches unintended UI drift, not pixel-identity with the mock.

Viewport: **1440×900**, `deviceScaleFactor: 1`, reduced motion. Diff tolerance: `maxDiffPixelRatio: 0.02`.

## Commands (PowerShell, from `frontend/`)

App on `:3000` (Playwright starts `next dev` unless `PLAYWRIGHT_BASE_URL` is set; readiness probes `/login`). Public slug seeded (see Lighthouse / seed).

```powershell
cd frontend

# First time: browsers (if needed)
pnpm test:a11y:install

# Create or refresh golden screenshots (review the PNGs, then commit)
pnpm test:visual:update

# Compare against committed baselines
pnpm test:visual
```

HTML report: `pnpm exec playwright show-report`.

Axe suite is unchanged: `pnpm test:a11y` runs only the `chromium` project.

## When a visual test fails

1. Open the diff in the Playwright report (expected / actual / diff).
2. If the change is intentional → `pnpm test:visual:update` and commit the new baselines.
3. If not → fix the UI regression.
4. Flakes from fonts/avatars: check reduced-motion CSS and that seed data is stable; bump `maxDiffPixelRatio` only with a short note here.
