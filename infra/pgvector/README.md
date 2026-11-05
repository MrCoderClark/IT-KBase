# pgvector on Windows PostgreSQL 18

The AI Assistant (`Docs/specs/20-ai-assistant.md`) uses hybrid retrieval: Postgres full-text search plus vector similarity. Vector similarity needs the **pgvector** extension in the TechBase database.

This runbook records how pgvector was installed on the dev/pilot database server and how to verify it.

| Item | Value |
|------|-------|
| Server | `192.168.70.10` (Windows) |
| PostgreSQL | 18.0, x64, `C:\Program Files\PostgreSQL\18` |
| Database | `aw_it_kbase` |
| pgvector | **0.8.7** |
| Installed from | Prebuilt Windows binary, [andreiramani/pgvector_pgsql_windows](https://github.com/andreiramani/pgvector_pgsql_windows) (unofficial), PostgreSQL 18 asset |
| Installed | 2026-11-02 |

> Commands below use `YOUR_PASSWORD`. Never commit the real password. Use a `postgresql://` URL, not `postgresql+asyncpg://`; `psql` does not accept the asyncpg prefix.

---

## 1. Check whether pgvector is available

Run from any machine with the PostgreSQL 18 client tools:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgresql://postgres:YOUR_PASSWORD@192.168.70.10:5432/aw_it_kbase" -c "SELECT version();" -c "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'vector';"
```

No `psql` locally? Use Docker:

```powershell
docker run --rm postgres:16 psql "postgresql://postgres:YOUR_PASSWORD@192.168.70.10:5432/aw_it_kbase" -c "SELECT version();" -c "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'vector';"
```

| Result | Meaning |
|--------|---------|
| `(0 rows)` | pgvector is not installed on the server. Go to step 2. |
| `vector \| 0.8.7 \|` (empty `installed_version`) | Files are installed; extension not yet enabled in this database. Go to step 3. |
| `vector \| 0.8.7 \| 0.8.7` | Installed and enabled. Go to step 4 to verify. |

Before install, the server returned `PostgreSQL 18.0 on x86_64-windows, compiled by msvc-19.44.35215, 64-bit` and `(0 rows)`.

---

## 2. Install pgvector on the database server

Do this **on the server** (`192.168.70.10`), signed in as an Administrator. pgvector must be installed where PostgreSQL runs, not on a developer workstation.

Choose one option.

### Option A — prebuilt binary (used on this server)

Unofficial build by andreiramani. Saves installing Visual Studio. The release notes say the builds were tested on PostgreSQL 18.4; they load on 18.0 because extensions are compatible within a major version.

Trust note: `vector.dll` runs inside the PostgreSQL server process. Download only from the repository's **Releases** page, scan the zip with Defender/AV before extracting, and prefer Option B for production.

1. Open <https://github.com/andreiramani/pgvector_pgsql_windows/releases>.
2. In release **pgvector v0.8.7 for PostgreSQL 13-18**, download the asset for **PostgreSQL 18**.
3. Scan the zip, then extract it.
4. Read `readme.txt` inside the zip. It is the authority if it differs from the steps below.
5. Copy the files:

| From the zip | To |
|--------------|----|
| `vector.dll` | `C:\Program Files\PostgreSQL\18\lib\` |
| `vector.control` and every `vector--*.sql` | `C:\Program Files\PostgreSQL\18\share\extension\` |
| `include` headers (optional) | `C:\Program Files\PostgreSQL\18\include\server\extension\vector\` |

The `include` folder is **optional**. The headers (`vector.h`, `halfvec.h`, `sparsevec.h`) are only used to compile other extensions on top of pgvector; PostgreSQL never reads them at runtime. The `vector` folder does not exist until you create it:

```powershell
New-Item -ItemType Directory -Force "C:\Program Files\PostgreSQL\18\include\server\extension\vector"
```

Copy the `.h` files **into** that folder. Do not end up with `...\extension\vector\include\...`. If the zip's `include` folder already repeats the Postgres layout (`include\server\extension\vector\*.h`), copy it onto `C:\Program Files\PostgreSQL\18\` and let Windows merge.

No restart and no `shared_preload_libraries` change are required.

### Option B — build from official source

From the official [pgvector README](https://github.com/pgvector/pgvector#windows).

1. Install **Visual Studio Build Tools** with the **Desktop development with C++** workload.
2. Open **x64 Native Tools Command Prompt for VS** as Administrator. It must be the x64 prompt. These are **CMD** commands, not PowerShell:

```cmd
set "PGROOT=C:\Program Files\PostgreSQL\18"
cd %TEMP%
git clone --branch v0.8.7 https://github.com/pgvector/pgvector.git
cd pgvector
nmake /F Makefile.win
nmake /F Makefile.win install
```

Build errors:

| Error | Fix |
|-------|-----|
| `Cannot open include file: 'postgres.h'` | `PGROOT` is wrong. Confirm PostgreSQL is at `C:\Program Files\PostgreSQL\18`. |
| `error C2196: case value '4' already used` | Wrong prompt. Use the **x64** Native Tools prompt, run `nmake /F Makefile.win clean`, repeat. |

No Visual Studio on the server? Build on another Windows machine with the same PostgreSQL 18 x64 install, then copy `lib\vector.dll` and `share\extension\vector*` to the same folders on the server.

---

## 3. Enable the extension in the TechBase database

Extensions are enabled **per database**. There is no other registration step.

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgresql://postgres:YOUR_PASSWORD@192.168.70.10:5432/aw_it_kbase" -c "CREATE EXTENSION IF NOT EXISTS vector;" -c "SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector AS cosine_distance;"
```

Expected: `CREATE EXTENSION`, then `0.00853986601633272`.

The TechBase Prisma migration for `ArticleChunk` also runs `CREATE EXTENSION IF NOT EXISTS vector`, so running this by hand first is harmless.

If it fails with `could not load library "...vector.dll"`, the DLL is in the wrong folder or was built for a different PostgreSQL major version.

---

## 4. Full verification

Checks the extension version, vector math, 1536-dimension columns (our embedding size), and that an HNSW index builds and is used. Runs in a transaction and ends with `ROLLBACK`, so it leaves nothing behind except the extension.

```powershell
$sql = @'
\echo '--- 1. extension installed'
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

\echo '--- 2. cosine distance (expect ~0.00854)'
SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector AS cosine_distance;

BEGIN;
\echo '--- 3. 1536-dim column + 200 random rows'
CREATE TEMP TABLE tb_vec_check (id int, embedding vector(1536));
INSERT INTO tb_vec_check
SELECT g, (SELECT array_agg(random()::real) FROM generate_series(1, 1536) WHERE g > 0)::vector
FROM generate_series(1, 200) AS g;
SELECT count(*) AS rows, vector_dims(embedding) AS dims FROM tb_vec_check GROUP BY 2;

\echo '--- 4. HNSW index builds and is used (expect "Index Scan using tb_vec_check_hnsw")'
CREATE INDEX tb_vec_check_hnsw ON tb_vec_check USING hnsw (embedding vector_cosine_ops);
SET LOCAL enable_seqscan = off;
EXPLAIN (COSTS OFF)
SELECT id FROM tb_vec_check
ORDER BY embedding <=> (SELECT embedding FROM tb_vec_check WHERE id = 1)
LIMIT 5;
ROLLBACK;
\echo '--- done (rolled back, nothing left behind)'
'@
$sql | & "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgresql://postgres:YOUR_PASSWORD@192.168.70.10:5432/aw_it_kbase" -v ON_ERROR_STOP=1
```

Expected output (recorded 2026-11-02):

| Step | Result |
|------|--------|
| 1 | `vector \| 0.8.7` |
| 2 | `0.00853986601633272` (exact: `1 − 17/√(14·21)`) |
| 3 | `200 \| 1536` |
| 4 | `Index Scan using tb_vec_check_hnsw on tb_vec_check` with `Order By: (embedding <=> …)` |
| end | `ROLLBACK`, then `--- done` |

In step 4, a `Seq Scan … Disabled: true` line inside `InitPlan 1` is expected. That is the `WHERE id = 1` lookup used to pick a sample vector (the test table has no index on `id`). It is not related to pgvector.

---

## 5. Upgrading pgvector

1. Install the new version's files using step 2 (same folders; overwrite).
2. In each database that uses it:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgresql://postgres:YOUR_PASSWORD@192.168.70.10:5432/aw_it_kbase" -c "ALTER EXTENSION vector UPDATE;" -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

3. Re-run step 4.
4. Update the table at the top of this file.

After a PostgreSQL **major** upgrade (for example 18 → 19), pgvector must be reinstalled for the new major version before the database starts using it.

---

## 6. Removing pgvector

Only if TechBase no longer uses vector search. This drops every `vector` column, including `ArticleChunk.embedding`.

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgresql://postgres:YOUR_PASSWORD@192.168.70.10:5432/aw_it_kbase" -c "DROP EXTENSION vector CASCADE;"
```

Then delete `vector.dll` from `lib\` and `vector*` files from `share\extension\` on the server.

---

## Related

- `Docs/specs/20-ai-assistant.md` — hybrid retrieval design
- ADR 0004 (pgvector + embeddings) — `Docs/specs/adr/`
- Official pgvector docs — <https://github.com/pgvector/pgvector>
