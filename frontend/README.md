# TechBase frontend (Next.js)

## Dev

```powershell
cd frontend
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Tests

```powershell
cd frontend

# Unit (tsx)
pnpm test

# Accessibility — Playwright + axe-core (WCAG 2.x A/AA serious/critical)
# First time only: install Chromium for Playwright
pnpm exec playwright install chromium

# Axe suite (auth setup once, then routes)
pnpm test:a11y

# One route by name
pnpm exec playwright test e2e/a11y.spec.ts -g "kb list" --project=chromium

# Visual regression (article public + signed-in snapshots)
pnpm test:visual:update
pnpm test:visual

# Last HTML report
pnpm exec playwright show-report
```

Needs a reachable app on `:3000` (Playwright starts `next dev` unless `PLAYWRIGHT_BASE_URL` is set) and a seeded Joe Clark account. Auth cookies are written once to `e2e/.auth/` (gitignored). Repeated full logins can hit the login rate limit. Public visual/Lighthouse slug must be `visibility: public`.

Keyboard-only checklist: `Docs/specs/13-a11y-keyboard.md`. Visual baselines: `Docs/specs/15-visual-regression.md`.

### Lighthouse (article view)

Gate = **public** article (no session): Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95. Signed-in shell is optional/info. Full notes: `Docs/specs/14-lighthouse.md`.

```powershell
cd frontend
pnpm add -D lighthouse chrome-launcher
pnpm exec prisma db seed   # marks the Lighthouse slug public

# Terminal A
pnpm build
pnpm start

# Terminal B — no auth needed for the gate
pnpm test:lighthouse
```

## Lint / types / build

```powershell
cd frontend
pnpm lint
pnpm typecheck
pnpm build
```
