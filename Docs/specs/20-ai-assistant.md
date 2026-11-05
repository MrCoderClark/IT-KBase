# 20 — AI Assistant

> Status: **proposal**. The `/assistant` sidebar link exists (badge `New`) but the route, API, and backend are not built. This spec defines what the assistant does, what it refuses to do, and the order we build it in.
>
> Related: `00-overview.md` (principle 4), `05-ai-ingestion.md` (LLM stack, budgets), `07-security.md` §8, `12-per-page-permissions.md`, `19-observability.md`, roadmap post-GA item 8.

---

## 1. What it is

The AI Assistant is a **grounded, cited helper over the TechBase knowledge base**. It answers IT questions using only articles the signed-in user is allowed to read. It helps authors draft and tidy articles, and helps KB owners keep the library healthy.

It is not a general chatbot. If the KB doesn't cover a question, the assistant says so plainly. It then logs the question as a coverage gap and offers to start a draft.

### The one-sentence test

> "Sam on the helpdesk pastes an Intune error, gets the three steps from KB-IT-1042 with a link to the exact section, and copies the command verbatim — in under five seconds."

---

## 2. Principles (non-negotiable)

1. **Grounded or silent.** Every factual claim in an answer cites a section from a KB article. Uncited claims are stripped or flagged. If the model only has general knowledge, the answer says so in a visible "Not from your KB" callout, or it declines.
2. **Permission-exact retrieval.** The assistant reads only what the user can read. It uses the same visibility rules as search (`searchVisibility` in `frontend/lib/queries/search.ts`), the status rules in `canReadArticle`, and the per-page effective access from spec 12. An answer must never cite or paraphrase an article the user couldn't open directly.
3. **Drafting assistant, not an author** (`00-overview.md` principle 4). It can create a **draft**. It never publishes, archives, restores a version, or changes permissions.
4. **Commands are quoted, never invented.** Commands, scripts, and registry paths come verbatim from article code blocks, with their source. The model may not write new shell commands into an answer. If no article has the command, the answer says so.
5. **Python owns the LLM call** (`claude.md` non-negotiable 8). Next.js retrieves, filters by permission, and streams. FastAPI calls the model. Same split as ingestion.
6. **IT-pro voice.** Imperative and concise, with numbers and IDs. No "As an AI…", no apologies, no emoji.
7. **Measurable.** Every answer is traced (spans, tokens, citations, latency). Users rate it with thumbs up/down, and those ratings feed analytics.

---

## 3. Capability catalogue

Grouped by who benefits. Each capability lists **grounding** (what data it may touch) and **role** (minimum role, see `07-security.md` §3).

### 3.1 Find & answer — for everyone who reads the KB

| # | Capability | What it does | Grounding | Role |
|---|------------|--------------|-----------|------|
| A1 | **Ask the KB** | Natural-language Q&A across the library. Returns a short answer, then numbered citations `[1]` that deep-link to `/kb/{slug}#section-anchor`. | Top-k FTS hits → section chunks | reader |
| A2 | **Ask this article** | Side panel on the article view. Scoped to the open article plus its lexical related set (`frontend/lib/kb/related.ts`). Example questions: "Does this work on Windows 10?", "What do I check if step 3 fails?" | Current article + related | reader |
| A3 | **Command finder** | "Give me the command to reset the local admin password." Returns the exact code block, its language/shell label, and the source section, with a copy button. Never paraphrases a command. | Code blocks only | reader |
| A4 | **Error-code lookup** | Detects tokens like `0x80180014`, `KB5034441`, `Event ID 4625`, or `ORA-12541` and boosts exact matches before ranking. | FTS + exact-token boost | reader |
| A5 | **Explain like I'm L1** | Rewrites a cited answer for a newer helpdesk tech, with the same citations and simpler wording. Toggle on the answer card. | Answer + citations already retrieved | reader |
| A6 | **Guided troubleshooting** | Turns an article's Steps and Troubleshooting sections into an interactive checklist. The user ticks "worked / didn't work"; on failure the assistant jumps to the matching troubleshooting callout or suggests a related article. | One article's sections | reader |
| A7 | **"Not in the KB" → gap** | Low-confidence or zero-hit answers are logged as a `KnowledgeGap` and the user sees "Draft this article" (authors) or "Request this article" (readers). | Question text only | reader |

### 3.2 Authoring copilot — for authors and up

| # | Capability | What it does | Grounding | Role |
|---|------------|--------------|-----------|------|
| B1 | **Draft from prompt** | "Write a runbook for rotating the Entra ID app secret for ServiceNow." Produces an `ArticleDraft` in the canonical sections and opens it in the editor as a **draft**. Prerequisites and Verification are left empty with TODO callouts when the model has nothing grounded to put there. | Prompt + existing taxonomy + optional pasted notes | author |
| B2 | **Draft from ticket / notes** | Paste resolved-ticket text, Teams notes, or a terminal transcript and get a structured draft. Reuses the `KBExtractor` shape from spec 05, so validation and repair behave the same. | Pasted text | author |
| B3 | **Tidy this draft** | In the editor: rewrite to house voice (imperative), split a wall of text into the canonical sections, write a summary, propose category and tags (**existing taxonomy only**), and estimate reading time. Shown as a reviewable suggestion diff — nothing changes until the author accepts. | Current draft | author |
| B4 | **Missing-section check** | "This draft has steps but no Verification. Suggested checks: …" Suggestions only. | Current draft | author |
| B5 | **Duplicate / overlap check** | Before submit-for-review: "3 published articles overlap with this one (KB-IT-1024, KB-IT-1088, …)", with a merge or link suggestion. | FTS over readable articles | author |
| B6 | **Risky-command flag** | Scans code blocks for destructive patterns (`format`, `diskpart clean`, `rm -rf`, `Remove-Item -Recurse -Force`, `reg delete`, `DROP TABLE`, `Set-ExecutionPolicy Unrestricted`). Suggests a Warning callout and a backup step. Pattern list plus LLM confirmation. | Current draft | author |

### 3.3 Review & KB health — for reviewers and admins

| # | Capability | What it does | Grounding | Role |
|---|------------|--------------|-----------|------|
| C1 | **Version diff summary** | Plain-English summary of what changed between two versions (spec 09), e.g. "Step 2 now targets Windows 11 24H2; troubleshooting adds BitLocker recovery." | Two `ArticleVersion` snapshots | reviewer |
| C2 | **Publish pre-check** | Runs the publish checklist (title, category, tag, summary, ≥ 1 step), plus B4 and B6, and returns pass/fail with reasons. | Draft | reviewer |
| C3 | **Staleness triage** | For articles not reviewed in 12+ months: flags likely-outdated references ("Windows 10", "Internet Explorer", "Azure AD" → "Entra ID", end-of-life Server versions) and proposes an update draft. | Stale articles | reviewer |
| C4 | **Feedback digest** | Summarizes not-helpful comments per article into themes and suggested edits. | `Feedback` rows | reviewer |
| C5 | **Coverage report** | Clusters open `KnowledgeGap` questions ("14 people asked about MFA re-registration this month") and ranks them by demand. Shown in Analytics. | `KnowledgeGap` rows | reviewer |
| C6 | **Taxonomy hygiene** | Suggests tag merges (`Win11` / `Windows 11` / `windows-11`) and items that look miscategorized. The admin applies the change; the assistant never edits taxonomy. | Tags, categories, counts | admin |

### 3.4 Later — needs new infrastructure

| # | Capability | Needs |
|---|------------|-------|
| D1 | Semantic retrieval (hybrid FTS + vectors) | pgvector + embeddings job (post-GA item 1) |
| D2 | Multi-turn memory across sessions | Conversation retention policy decision (§10) |
| D3 | Teams / ServiceNow bot surface | Integrations (spec 04 F10); same `/api/assistant` contract |
| D4 | Ticket triage from ServiceNow / Jira | Ticket-system import (post-GA item 6) |
| D5 | Screenshot / error-dialog Q&A | Vision-capable model + upload path |
| D6 | Scheduled "KB health" digest email | Cron (exists for purge) + email (Resend) |

### 3.5 Explicitly out of scope

- Running commands, scripts, or remote actions on endpoints, or calling RMM/Intune/AD APIs.
- Browsing the public internet or citing external sites.
- Publishing, archiving, restoring, deleting, or changing page permissions.
- Answering from drafts the user can't see. An author's own drafts are included only when the user turns on "Include my drafts" (author+).
- Storing secrets pasted into prompts beyond the retention window (§8). The UI warns when a prompt looks like it contains credentials.

---

## 4. UX

Visual rules come from `02-design-system.md`. Nothing here overrides it.

### 4.1 `/assistant` page

```
┌──────────── sidebar ───────────┬──────────────────────── canvas ─────────────────────────┬──── rail (320) ────┐
│ … AI Assistant (active)        │  Ask the knowledge base                                 │ Sources            │
│                                │  ┌────────────────────────────────────────────────────┐ │ [1] KB-IT-1024     │
│                                │  │ Q: Intune Autopilot fails with 0x80180014          │ │     §Troubleshoot  │
│                                │  ├────────────────────────────────────────────────────┤ │ [2] KB-IT-1088     │
│                                │  │ This error means the device is blocked by an       │ │     §Prerequisites │
│                                │  │ enrollment restriction [1]. Remove the device      │ │                    │
│                                │  │ record, then re-register the hash [1][2].          │ │ Related            │
│                                │  │ ┌ code ─────────────────────────────── copy ┐      │ │  Autopilot reset   │
│                                │  │ │ Get-WindowsAutopilotInfo -Online          │ [1]  │ │  Entra device join │
│                                │  │ └───────────────────────────────────────────┘      │ │                    │
│                                │  │ [Up][Down]  Explain like I'm L1  Open KB-IT-1024 → │ │ Not finding it?    │
│                                │  └────────────────────────────────────────────────────┘ │  Draft this article│
│                                │  [ Ask a follow-up…                       ⌘↵ Send ]     │                    │
└────────────────────────────────┴─────────────────────────────────────────────────────────┴────────────────────┘
```

- **Answer card**: surface card, `--radius-xl`. Citation chips are cobalt pill badges `[1]`. Hovering one previews the cited section text; clicking it deep-links to the section.
- **Code** uses the article `CodeBlock` composite (copy affordance, language label). Every code block carries a citation chip. A code block without one is a bug.
- **"Not from your KB"**: Warning callout variant, shown above any uncited content.
- **Empty state**: four suggested prompts with real IT content (e.g. "Reset a Windows 11 local admin password", "Why is a shared mailbox missing in OWA?"), plus a line stating the scope: "Answers come only from articles you can open."
- **Streaming**: tokens stream in. Citations render as they resolve. Show a "Searching 248 articles…" step before the first token.

### 4.2 In-article panel (A2, A6)

- "Ask about this article" button in the article actions row, plus keyboard shortcut `a`.
- Opens a right-side **sheet** over the meta rail. Needs `pnpm dlx shadcn@latest add sheet` (user installs per `claude.md` §0.3).

### 4.3 Editor copilot (B3–B6)

- A "Copilot" tab in the editor's structure sidebar. Suggestions appear as accept/reject cards with an inline diff. Nothing applies until the author accepts.

### 4.4 Command palette

- `Ctrl+K` gets an **Ask AI** scope: typing a question and pressing `Tab` → `Enter` opens `/assistant?q=…` with the question submitted.

### 4.5 Keyboard

| Key | Action |
|-----|--------|
| `g s` | Go to Assistant |
| `a` | Ask about this article (article view) |
| `⌘/Ctrl + Enter` | Send |
| `Esc` | Stop streaming / close panel |
| `[` / `]` | Previous / next citation in the focused answer |

---

## 5. Architecture

Same shape as ingestion: the BFF does auth and permissions, Python calls the LLM, and the response streams back over SSE.

```
Browser ──POST /api/assistant/messages (SSE)──▶ Next.js BFF
                                                 │ 1. session + role + rate limit
                                                 │ 2. retrieve: searchArticles() → readable hits
                                                 │    + per-page effective access (spec 12)
                                                 │ 3. chunk by section, cap tokens, build ContextBundle
                                                 │ 4. mint 60s HMAC assertion (ADR 0001)
                                                 ▼
                                  FastAPI POST /assistant/answer (SSE)
                                                 │ 5. prompt (fixed system + bundle as data)
                                                 │ 6. LLM via AI_* (OpenRouter today)
                                                 │ 7. validate citations ⊆ bundle chunk ids
                                                 ▼
                     events: retrieval · token · citation · done · failed
                                                 │
                                    Next persists message + citations,
                                    logs KnowledgeGap if ungrounded
```

### 5.1 Why retrieval stays in Next

FastAPI never touches Postgres (`01-architecture.md` §2.3), and the permission logic (`can()`, `canReadArticle`, per-page access) already lives in TypeScript. The BFF sends FastAPI only text the user is allowed to see. **The LLM service cannot leak what it never receives.**

### 5.2 Retrieval (v1, no embeddings)

1. Normalize the question and pull out exact tokens: error codes, KB IDs, cmdlet names.
2. `searchArticles(query, k=8, role, userId)` (existing FTS, `websearch_to_tsquery`), plus an exact-token boost.
3. For A2, start with the current article, then add `related.ts` hits.
4. Expand each hit into **section chunks** (`Section` + `Block` text). Code blocks stay whole and are tagged `kind=code`.
5. Rank chunks, then cap the bundle at ~6k tokens. Each chunk gets a stable ID: `{articleId}:{versionId}:{sectionId}[:{blockId}]`.
6. If the top score is below a threshold → `grounded=false`. Skip the LLM call (saves cost) and return the "Not in the KB" path with the nearest three articles.

### 5.3 Answer contract (FastAPI)

- System prompt: role, voice rules, and "use only the provided chunks; cite chunk ids as `[n]`; copy code verbatim from `kind=code` chunks only; if the chunks don't answer, say so."
- The bundle is passed as **data** in a delimited section (prompt-injection boundary, `07-security.md` §8). Article text cannot issue instructions.
- Output is streamed text with inline `[n]` markers, followed by a final JSON `done` event: `{ answer, citations: [{n, chunkId}], grounded, usage }`.
- **Post-validation** in Python:
  - Drop citations whose `chunkId` isn't in the bundle.
  - A sentence with no citation and `grounded=true` → wrap it in the "Not from your KB" block.
  - A code block whose text isn't a substring of some cited `kind=code` chunk → remove it and add the note "Command not found in KB".

### 5.4 Pluggable answerer

Mirror the `KBExtractor` protocol (`backend/src/backend/extractors/protocol.py`):

```python
class KBAnswerer(Protocol):
    def answer(self, question: str, bundle: ContextBundle, history: list[Turn]) -> Iterator[AnswerEvent]: ...
```

Implementations: `OpenAICompatibleAnswerer` (OpenRouter/OpenAI/local via `AI_BASE_URL`) and `FakeAnswerer` (deterministic, used in CI).

### 5.5 Streaming

The FastAPI endpoint should be an **async generator**, or use `telemetry.iter_with_context` if it stays sync. This is the lesson from the ingest `Failed to detach context` bug (spec 19): never attach an OTel context once across yields.

---

## 6. Data model (Prisma, `frontend/prisma/schema.prisma`)

```prisma
model AssistantConversation {
  id        String             @id @default(cuid())
  userId    String
  title     String?            // first question, truncated
  scope     AssistantScope     @default(library)  // library | article
  articleId String?            // set when scope = article
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
  messages  AssistantMessage[]
  @@index([userId, updatedAt])
}

model AssistantMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           AssistantRole       // user | assistant
  content        String
  citations      Json?               // [{ n, chunkId, articleId, slug, sectionAnchor, versionId }]
  grounded       Boolean  @default(true)
  model          String?
  tokensIn       Int?
  tokensOut      Int?
  latencyMs      Int?
  traceId        String?             // OTel trace id for Grafana jump
  helpful        Boolean?            // thumbs; null = unrated
  createdAt      DateTime @default(now())
  conversation   AssistantConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
}

model KnowledgeGap {
  id              String    @id @default(cuid())
  normalized      String    @unique   // lowercased, stop-worded question key
  sampleQuestion  String
  askCount        Int       @default(1)
  lastAskedAt     DateTime  @default(now())
  status          GapStatus @default(open)   // open | drafted | dismissed
  draftArticleId  String?
  @@index([status, askCount])
}

enum AssistantScope { library article }
enum AssistantRole  { user assistant }
enum GapStatus      { open drafted dismissed }
```

Citations store `versionId`. If an article changes later, the old answer shows "cites v1.2 — current is v1.4".

---

## 7. API

### 7.1 Next.js (browser-facing)

```
POST /api/assistant/messages            # SSE; body { conversationId?, question, scope, articleId?, includeMyDrafts? }
GET  /api/assistant/conversations       # own conversations, cursor-paginated
GET  /api/assistant/conversations/:id
DELETE /api/assistant/conversations/:id # soft delete, own only
POST /api/assistant/messages/:id/feedback   # { helpful: bool, comment? }
POST /api/assistant/draft               # author+; { prompt | sourceText } → { articleId, slug } (draft)
POST /api/assistant/suggest             # author+; { articleId, kinds: [tidy|missing|risky|duplicates] }
GET  /api/assistant/gaps                # reviewer+; clustered coverage report
PATCH /api/assistant/gaps/:id           # reviewer+; { status }
```

SSE events (same envelope as `/api/jobs/{id}/stream`):

```
event: retrieval   data: { articles: n, chunks: n, grounded: bool }
event: token       data: { text }
event: citation    data: { n, slug, title, sectionAnchor, versionId }
event: done        data: { messageId, grounded, usage: { tokensIn, tokensOut }, traceId }
event: failed      data: { code, message }
```

### 7.2 FastAPI (internal, assertion-authenticated)

```
POST /assistant/answer     # SSE; { question, history[], bundle: Chunk[], mode: answer|eli5|command }
POST /assistant/draft      # { prompt | sourceText, taxonomy: {categories[], tags[]} } → ParsedDraft
POST /assistant/review     # { draft, checks[] } → { suggestions: [...] }
```

Pydantic is the source of truth → OpenAPI → `pnpm gen:types` (`06-api.md` §8).

---

## 8. Security, privacy, cost

| Concern | Control |
|---------|---------|
| Cross-permission leak | Retrieval runs in the BFF with the user's role and per-page access. Contract test: an answer for a reader must never cite a draft or a restricted page (§11). |
| Prompt injection via article text | Bundle passed as delimited data. No tool calls. Output post-validated against the bundle. |
| Invented commands | Verbatim-substring check against `kind=code` chunks (§5.3). |
| Secrets in prompts | Client-side warning on patterns (`password=`, `-----BEGIN`, `AKIA…`, connection strings). Messages are redacted in logs. Stored only for the retention window. |
| Retention | Default **30 days** for conversations (admin setting). Hard delete after that via the existing purge cron. |
| Opt-out | `allow_llm_processing=false` (spec 05 §8) disables the assistant entirely; the sidebar item hides. |
| Rate limits | Per-user 60 messages/hour, 300/day (Redis `rate:{userId}:assistant:*`). `429` with `Retry-After`. |
| Token budget | Shares the tenant monthly LLM budget with ingestion (spec 05 §6). Ungrounded questions skip the LLM call entirely. |
| Audit | `assistant.draft.created` in the audit log. Messages themselves aren't audit events. |

---

## 9. Observability

Spans (extend `19-observability.md` and the Grafana dashboard):

- Next: `assistant.request` → `assistant.retrieve` (attrs `tb.hits`, `tb.chunks`, `tb.grounded`) → HTTP to FastAPI with `traceparent`.
- FastAPI: `assistant.answer` → `assistant.llm` (attrs `tb.model`, `tb.tokens_in`, `tb.tokens_out`, `tb.citations`, `tb.dropped_citations`).
- New dashboard panels: p50/p95 time-to-first-token, grounded %, thumbs-up %, dropped-citation rate, top gap questions.

---

## 10. Open questions

| # | Question | Default if undecided |
|---|----------|----------------------|
| Q1 | The sidebar currently shows **AI Assistant only to roles that can create** (`sidebar.tsx` → `canCreate`). Readers — Sam, helpdesk L1 — are the biggest beneficiaries of A1–A7. Open the assistant to readers? | **Yes**: A1–A7 for readers; authoring and health features stay role-gated. Requires a one-line sidebar change. |
| Q2 | Conversation retention: 30 days, 7 days, or no storage (stateless)? | 30 days, admin-configurable. |
| Q3 | Assistant model: same as ingestion (`AI_MODEL`) or a separate, cheaper/faster one? | Separate `AI_ASSISTANT_MODEL`, falling back to `AI_MODEL`. |
| Q4 | Include authors' own drafts in answers by default? | Off; per-message toggle. |
| Q5 | Pull embeddings (D1) forward into A-phase if FTS recall is poor on the eval set? | Decide after the A1 eval (§11). |

---

## 11. Quality & evaluation

- **Golden set**: 40 question/answer pairs built from seed articles (Windows, Entra, Intune, M365, Linux, Networking): 30 answerable, 10 deliberately out-of-KB.
- **Metrics** (run in CI with `FakeAnswerer` for structure; nightly `@pytest.mark.live` with the real model, like spec 05 §7):
  - Citation precision: cited chunk actually supports the sentence ≥ **90%**.
  - Refusal correctness on out-of-KB questions ≥ **90%**.
  - Command fidelity: 100% of returned code blocks are verbatim KB substrings.
- **Security contract tests**:
  - A reader asking about content that only exists in a draft or a `role_floor=reviewer` page gets `grounded=false` and no citation to it.
  - An article containing "ignore previous instructions…" does not change system behavior.
- **E2E**: Playwright on `/assistant` and the article panel. Axe clean (spec 13).

---

## 12. Build phases

Each phase ships behind the existing sidebar link and is demo-able on its own.

| Phase | Scope | Outcome / acceptance |
|-------|-------|----------------------|
| **AI-1 — Ask the KB** | A1, A3, A4, A7 (gap logging only). `/assistant` page, SSE, citations, `KnowledgeGap`, rate limits, spans. | A reader asks "0x80180014" and gets a cited answer in < 5s p50. Out-of-KB questions return "Not in the KB" with no LLM call. Golden-set targets met. |
| **AI-2 — In-article** | A2, A5, A6 panel + guided troubleshooting; `a` shortcut; `sheet` install. | From an article, "what if step 3 fails?" jumps to the right troubleshooting callout. |
| **AI-3 — Authoring copilot** | B1–B6; editor Copilot tab; `/api/assistant/draft` creates drafts only. | Paste ticket notes → draft in the canonical shape in < 30s. Tidy suggestions apply only on accept. |
| **AI-4 — Review & health** | C1–C6; coverage report in Analytics; gap → draft flow. | Reviewer sees the top 10 gap clusters and can turn one into a draft in two clicks. |
| **AI-5 — Smarter retrieval** | D1 hybrid search; D2 memory (if Q2 allows). | Golden-set recall improves ≥ 15 points over FTS-only. |

Suggested branches: `feat/assistant-ask-kb`, `feat/assistant-article-panel`, `feat/assistant-copilot`, `feat/assistant-kb-health`, `feat/assistant-hybrid-search`.

---

## 13. Success metrics (90 days after AI-1)

| Metric | Target |
|--------|--------|
| Weekly active assistant users / weekly KB users | ≥ 40% |
| Answers with ≥ 1 valid citation (when grounded) | ≥ 95% |
| Thumbs-up ratio on rated answers | ≥ 70% |
| Time to first token p50 / p95 | < 1.5s / < 4s |
| Gap questions turned into published articles | ≥ 25% of top-20 gaps |
| Answers citing an article the user can't open | **0** |
