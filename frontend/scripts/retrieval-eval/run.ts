/**
 * Retrieval golden-set evaluator (spec 20 §12 AI-5 acceptance criterion).
 * One-shot CLI that runs each fixture question through `retrieveChunks` under
 * several rerank configurations, and prints Precision@k, MRR, and grounded-rate
 * per config so the AI-5 "≥ 5 points over AI-1" claim can be measured.
 *
 *   cd frontend
 *   # all three configs, k=5, default admin session:
 *   pnpm eval:retrieval
 *   # deterministic only (no model key required):
 *   pnpm eval:retrieval --config det
 *   # measure visibility deliberately (reader-scoped retrieval):
 *   pnpm eval:retrieval --as reader
 *   # tighten k:
 *   pnpm eval:retrieval --k 3
 *   # scope to the first N fixtures:
 *   pnpm eval:retrieval --limit 5
 *
 * The LLM config needs `ASSISTANT_RERANK_ENABLED=1` on the FastAPI side and an
 * `ASSISTANT_API_KEY`; this script ignores `ASSISTANT_LLM_RERANK` and asks for
 * each rerank path explicitly so the measured numbers are unambiguous.
 *
 * Runs as admin by default so what's measured is retrieval quality, not per-page
 * visibility. A pre-flight `/healthz` probe refuses to run if the backend is
 * not reachable, so a dead-backend run can't be mistaken for a bad-retrieval
 * result.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appSessionForUserId } from "../../lib/ingestion/worker-session";
import { retrieveChunks, type RetrievalRerank } from "../../lib/assistant/retrieval";
import { prisma } from "../../lib/db";
import { ensureIngestOtel } from "../../lib/otel/ingest";
import { loadEnvFiles } from "../load-env";

loadEnvFiles();
ensureIngestOtel();

const HERE = dirname(fileURLToPath(import.meta.url));

type Fixture = {
  id: string;
  question: string;
  expected: string[];
  note?: string;
};

type Config = "none" | "det" | "llm";
type SessionRole = "reader" | "author" | "reviewer" | "admin";
const ALL_CONFIGS: Config[] = ["none", "det", "llm"];
const SESSION_ROLES: SessionRole[] = ["reader", "author", "reviewer", "admin"];
const DEFAULT_K = 5;
const DEFAULT_SESSION_ROLE: SessionRole = "admin";

type QueryResult = {
  fixtureId: string;
  question: string;
  expected: string[];
  returned: string[];
  grounded: boolean;
  precisionAtK: number;
  firstHitRank: number | null; // 1-indexed; null means no expected slug appeared
  error?: string;
};

type ConfigReport = {
  config: Config;
  queries: QueryResult[];
  precisionAtK: number;
  mrr: number;
  groundedRate: number;
  errors: number;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await requireBackend();
  const fixtures = loadFixtures(args.limit);
  const configs: Config[] =
    args.config === "all" ? ALL_CONFIGS : [args.config as Config];

  const defaultSession = await pickSession(args.as);
  if (!defaultSession) {
    console.error(`No seeded ${args.as} found. Seed the database first.`);
    process.exit(1);
  }
  console.info(`session: ${defaultSession.email} (${defaultSession.role})`);

  const reports: ConfigReport[] = [];
  for (const config of configs) {
    console.info(`\n=== config: ${config} ===`);
    const queries: QueryResult[] = [];
    for (const fixture of fixtures) {
      const q = await runQuery(fixture, defaultSession, config, args.k);
      queries.push(q);
      const marker = q.error ? "!" : q.firstHitRank === 1 ? "✓" : q.firstHitRank ? "·" : "✗";
      const detail = q.error
        ? ` ERROR: ${q.error}`
        : ` p@${args.k}=${q.precisionAtK.toFixed(2)} rank=${q.firstHitRank ?? "—"}`;
      console.info(`  ${marker} ${fixture.id}  ${fixture.question.slice(0, 60).padEnd(60)}${detail}`);
    }
    reports.push(summarize(config, queries));
  }

  console.info("\n=== summary ===");
  console.info(
    ["config".padEnd(8), `p@${args.k}`.padEnd(8), "mrr".padEnd(8), "grounded".padEnd(10), "errors"].join(" "),
  );
  for (const r of reports) {
    console.info(
      [
        r.config.padEnd(8),
        r.precisionAtK.toFixed(3).padEnd(8),
        r.mrr.toFixed(3).padEnd(8),
        r.groundedRate.toFixed(3).padEnd(10),
        String(r.errors),
      ].join(" "),
    );
  }

  const reportPath = writeReport(reports, args.k);
  console.info(`\nreport → ${reportPath}`);
}

type ParsedArgs = {
  config: Config | "all";
  k: number;
  limit: number | null;
  as: SessionRole;
};

function parseArgs(argv: string[]): ParsedArgs {
  let config: Config | "all" = "all";
  let k = DEFAULT_K;
  let limit: number | null = null;
  let as: SessionRole = DEFAULT_SESSION_ROLE;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config") {
      const next = argv[++i];
      if (next !== "none" && next !== "det" && next !== "llm" && next !== "all") {
        console.error(`--config must be none|det|llm|all, got ${next}`);
        process.exit(1);
      }
      config = next;
    } else if (arg === "--k") {
      k = Number(argv[++i]);
      if (!Number.isInteger(k) || k < 1) {
        console.error(`--k must be a positive integer`);
        process.exit(1);
      }
    } else if (arg === "--limit") {
      limit = Number(argv[++i]);
      if (!Number.isInteger(limit) || limit < 1) {
        console.error(`--limit must be a positive integer`);
        process.exit(1);
      }
    } else if (arg === "--as") {
      const next = argv[++i];
      if (!SESSION_ROLES.includes(next as SessionRole)) {
        console.error(`--as must be one of ${SESSION_ROLES.join("|")}, got ${next}`);
        process.exit(1);
      }
      as = next as SessionRole;
    } else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }
  return { config, k, limit, as };
}

/**
 * Probe `/healthz` before running the fixtures. A dead backend used to produce
 * a silent "keyword-only" run that looked like bad retrieval; now it fails fast.
 */
async function requireBackend(): Promise<void> {
  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/healthz`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error(`Backend at ${base} returned HTTP ${response.status} on /healthz.`);
      process.exit(1);
    }
  } catch {
    console.error(
      `Backend at ${base} is not reachable. Start it (\`uv run backend\` from backend/) and retry.`,
    );
    process.exit(1);
  }
}

function loadFixtures(limit: number | null): Fixture[] {
  const raw = readFileSync(resolve(HERE, "fixtures.json"), "utf8");
  const all = JSON.parse(raw) as Fixture[];
  return limit === null ? all : all.slice(0, limit);
}

async function pickSession(role: SessionRole) {
  const user = await prisma.user.findFirst({ where: { role }, select: { id: true } });
  if (!user) return null;
  return appSessionForUserId(user.id);
}

async function runQuery(
  fixture: Fixture,
  session: NonNullable<Awaited<ReturnType<typeof appSessionForUserId>>>,
  config: Config,
  k: number,
): Promise<QueryResult> {
  const rerank: RetrievalRerank = config;
  try {
    const result = await retrieveChunks({
      question: fixture.question,
      session,
      rerank,
      limit: Math.max(k, DEFAULT_K),
    });
    const returned = dedupeBy(result.chunks.map((c) => c.slug));
    const topK = returned.slice(0, k);
    const expected = new Set(fixture.expected);
    const hitsAtK = topK.filter((slug) => expected.has(slug)).length;
    const firstHit = returned.findIndex((slug) => expected.has(slug));
    return {
      fixtureId: fixture.id,
      question: fixture.question,
      expected: fixture.expected,
      returned: topK,
      grounded: result.grounded,
      precisionAtK: k === 0 ? 0 : hitsAtK / k,
      firstHitRank: firstHit === -1 ? null : firstHit + 1,
    };
  } catch (err) {
    return {
      fixtureId: fixture.id,
      question: fixture.question,
      expected: fixture.expected,
      returned: [],
      grounded: false,
      precisionAtK: 0,
      firstHitRank: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function dedupeBy<T>(xs: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function summarize(config: Config, queries: QueryResult[]): ConfigReport {
  const ok = queries.filter((q) => !q.error);
  const n = ok.length || 1;
  const precisionAtK = ok.reduce((sum, q) => sum + q.precisionAtK, 0) / n;
  const mrr =
    ok.reduce((sum, q) => sum + (q.firstHitRank ? 1 / q.firstHitRank : 0), 0) / n;
  const groundedRate = ok.reduce((sum, q) => sum + (q.grounded ? 1 : 0), 0) / n;
  return {
    config,
    queries,
    precisionAtK,
    mrr,
    groundedRate,
    errors: queries.length - ok.length,
  };
}

function writeReport(reports: ConfigReport[], k: number): string {
  const dir = resolve(HERE, "reports");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(dir, `${stamp}.json`);
  writeFileSync(path, JSON.stringify({ k, reports }, null, 2), "utf8");
  return path;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
