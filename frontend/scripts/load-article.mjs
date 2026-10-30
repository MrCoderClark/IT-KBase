/**
 * Article-detail load gate (suggested-order item 31 / Docs/specs/16-load.md).
 *
 * Hammers the public article URL with a fixed connection pool for DURATION_S
 * seconds. Passes when RPS ≥ MIN_RPS, error rate < MAX_ERROR_RATE, p99 ≤ MAX_P99_MS.
 *
 * Prefer production: `pnpm build` then `pnpm start`.
 */

const BASE =
  process.env.LOAD_ARTICLE_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3000";
const PATH =
  process.env.LOAD_ARTICLE_PATH ??
  "/kb/windows-11-resetting-local-administrator-password";
const DURATION_S = Number(process.env.LOAD_ARTICLE_DURATION_S ?? 30);
// Local SSR health defaults — roadmap 1k rps needs cache/CDN (Docs/specs/16-load.md).
const CONNECTIONS = Number(process.env.LOAD_ARTICLE_CONNECTIONS ?? 50);
const MIN_RPS = Number(process.env.LOAD_ARTICLE_MIN_RPS ?? 15);
const MAX_ERROR_RATE = Number(process.env.LOAD_ARTICLE_MAX_ERROR_RATE ?? 0.01);
const MAX_P99_MS = Number(process.env.LOAD_ARTICLE_MAX_P99_MS ?? 5000);

const TARGET = new URL(PATH, BASE).toString();

function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)];
}

async function oneRequest(signal) {
  const t0 = performance.now();
  try {
    const res = await fetch(TARGET, {
      signal,
      headers: { Accept: "text/html", "Cache-Control": "no-cache" },
      redirect: "manual",
    });
    const ms = performance.now() - t0;
    // Public article must stay on /kb/... (307 to /login is a fail).
    const ok = res.status >= 200 && res.status < 400 && res.status !== 307 && res.status !== 302;
    // Drain body so sockets reuse cleanly.
    await res.arrayBuffer().catch(() => undefined);
    return { ok, ms, status: res.status };
  } catch {
    return { ok: false, ms: performance.now() - t0, status: 0 };
  }
}

async function worker(deadline, samples, counters) {
  while (performance.now() < deadline) {
    const result = await oneRequest(AbortSignal.timeout(30_000));
    samples.push(result.ms);
    counters.total += 1;
    if (result.ok) counters.ok += 1;
    else counters.err += 1;
  }
}

async function main() {
  console.log(`Load article: ${TARGET}`);
  console.log(
    `connections=${CONNECTIONS} duration=${DURATION_S}s minRps=${MIN_RPS} maxErr=${MAX_ERROR_RATE} maxP99=${MAX_P99_MS}ms`,
  );

  // Warm one request so cold compile does not tank the window.
  const warm = await oneRequest(AbortSignal.timeout(60_000));
  if (!warm.ok) {
    console.error(
      `Warmup failed (status ${warm.status}). Is the app up? Is the slug visibility=public?`,
    );
    process.exit(1);
  }

  const samples = [];
  const counters = { total: 0, ok: 0, err: 0 };
  const deadline = performance.now() + DURATION_S * 1000;
  const started = performance.now();

  await Promise.all(
    Array.from({ length: CONNECTIONS }, () => worker(deadline, samples, counters)),
  );

  const elapsedS = (performance.now() - started) / 1000;
  const rps = counters.total / elapsedS;
  const errorRate = counters.total === 0 ? 1 : counters.err / counters.total;
  const sorted = samples.slice().sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  console.log(
    JSON.stringify(
      {
        requests: counters.total,
        ok: counters.ok,
        errors: counters.err,
        elapsedS: Number(elapsedS.toFixed(2)),
        rps: Number(rps.toFixed(1)),
        errorRate: Number(errorRate.toFixed(4)),
        p50Ms: Math.round(p50),
        p95Ms: Math.round(p95),
        p99Ms: Math.round(p99),
      },
      null,
      2,
    ),
  );

  const fails = [];
  if (rps < MIN_RPS) fails.push(`rps ${rps.toFixed(1)} < ${MIN_RPS}`);
  if (errorRate > MAX_ERROR_RATE) {
    fails.push(`errorRate ${(errorRate * 100).toFixed(2)}% > ${MAX_ERROR_RATE * 100}%`);
  }
  if (p99 > MAX_P99_MS) fails.push(`p99 ${Math.round(p99)}ms > ${MAX_P99_MS}ms`);

  if (fails.length) {
    console.error("FAIL:", fails.join("; "));
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
