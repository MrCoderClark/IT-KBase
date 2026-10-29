# 14 — Lighthouse (article view)

> Gate for suggested-order item 29.

## What we measure

| Run | URL / session | Gate? | Targets |
|-----|---------------|-------|---------|
| **Public article (primary)** | `/kb/[slug]` with **no** session (proxy → public read, no app shell) | **Yes** | Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95 |
| Signed-in shell (secondary) | Same slug with Joe’s cookies | No — informational | Same numbers reported; shell TBT is a follow-up |

Default slug: `windows-11-resetting-local-administrator-password` (seeded `visibility: public`).

SEO is out of scope.

## Why public for the Perf gate

The signed-in shell (sidebar, notifications, shortcuts) hydrates enough JS that Total Blocking Time keeps Perf ~80 on desktop lab runs. The roadmap target is the **article read experience**; the public view is that content without admin chrome. Signed-in Perf stays visible via `LIGHTHOUSE_MODE=both` until shell TBT is attacked separately.

## Commands (PowerShell, from `frontend/`)

```powershell
cd frontend

# Dependencies (once)
pnpm add -D lighthouse chrome-launcher

# Ensure the seed article is public (re-seed, or one-shot SQL below)
pnpm exec prisma db seed

# Terminal A — webpack production build
pnpm build
pnpm start

# Terminal B — primary gate (no auth)
pnpm test:lighthouse

# Optional: also print signed-in scores (needs auth file)
pnpm test:lighthouse:auth
$env:LIGHTHOUSE_MODE = "both"
pnpm test:lighthouse
```

### One-shot SQL if you skip re-seed

```powershell
@"
UPDATE ""Article"" SET visibility = 'public'
WHERE slug = 'windows-11-resetting-local-administrator-password';
"@ | pnpm exec prisma db execute --stdin --schema prisma/schema.prisma
```

### Env

| Variable | Default |
|----------|---------|
| `LIGHTHOUSE_BASE_URL` | `http://127.0.0.1:3000` |
| `LIGHTHOUSE_PATH` | `/kb/windows-11-resetting-local-administrator-password` |
| `LIGHTHOUSE_MODE` | `public` (`both` / `signed-in` add the shell report) |

Reports: `frontend/lighthouse-report/` (`latest.html` = public gate). Gitignored.

## When the public gate fails

1. Confirm you are not logged in for the primary run (no cookie). Landing on `/login` means the article is still private.
2. Prefer `pnpm start` after `pnpm build`, not `next dev`.
3. Open `lighthouse-report/latest.html` for opportunities.
4. Best Practices CSP issues: webpack production build + current CSP (no `strict-dynamic` until Next nonces all chunks).
