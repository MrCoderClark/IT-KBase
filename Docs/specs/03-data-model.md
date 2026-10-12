# 03 — Data Model

## 1. Entity overview

```
User ──< ArticleVersion >── Article ──< Section
                               │          └─< Block (prose, step, callout, code, image)
                               │
                               ├──< ArticleTag >── Tag
                               ├── Category
                               ├──< Feedback
                               ├──< ViewEvent (rolled up)
                               └── IngestionJob (optional link to source)

User ─── Role (enum)
IngestionJob ── SourceFile (S3 object)
```

Every write to an article creates a new `ArticleVersion`. `Article` holds pointers to `currentVersionId` (published) and `draftVersionId` (editing). This is cheaper than CRDT but gives us rollback, diff, and audit for free.

## 2. Postgres schema (Prisma)

```prisma
// prisma/schema.prisma

enum Role {
  reader
  author
  reviewer
  admin
}

enum ArticleStatus {
  draft
  in_review
  published
  archived
}

enum SectionKind {
  overview
  prerequisites
  steps
  verification
  troubleshooting
  related
  custom
}

enum BlockKind {
  prose
  step
  callout
  code
  image
  checklist
}

enum CalloutVariant {
  info
  important
  warning
  success
}

enum SourceKind {
  docx
  pdf
  manual
  url
}

enum JobStatus {
  queued
  parsing
  extracting
  structuring
  validating
  succeeded
  failed
  cancelled
}

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  role        Role     @default(author)
  avatarUrl   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  articles    Article[]        @relation("ArticleAuthor")
  versions    ArticleVersion[] @relation("VersionAuthor")
  feedback    Feedback[]
}

model Category {
  id        String    @id @default(cuid())
  name      String    @unique
  slug      String    @unique
  color     String?   // optional tint override
  articles  Article[]
}

model Tag {
  id        String        @id @default(cuid())
  name      String        @unique
  slug      String        @unique
  articles  ArticleTag[]
}

model Article {
  id                 String          @id @default(cuid())
  slug               String          @unique
  title              String
  summary            String?
  heroImageUrl       String?
  status             ArticleStatus   @default(draft)
  readingTimeMinutes Int             @default(0)
  version            String          @default("1.0")

  categoryId         String?
  category           Category?       @relation(fields: [categoryId], references: [id])

  authorId           String
  author             User            @relation("ArticleAuthor", fields: [authorId], references: [id])

  currentVersionId   String?         @unique
  currentVersion     ArticleVersion? @relation("CurrentVersion", fields: [currentVersionId], references: [id])

  draftVersionId     String?         @unique
  draftVersion       ArticleVersion? @relation("DraftVersion", fields: [draftVersionId], references: [id])

  versions           ArticleVersion[] @relation("ArticleVersions")

  tags               ArticleTag[]
  feedback           Feedback[]
  ingestionJob       IngestionJob?

  views              Int             @default(0)
  helpful            Int             @default(0)
  notHelpful         Int             @default(0)

  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  publishedAt        DateTime?

  // Full-text search
  searchVector       Unsupported("tsvector")?

  @@index([status, updatedAt])
  @@index([categoryId])
}

model ArticleVersion {
  id         String   @id @default(cuid())
  articleId  String
  article    Article  @relation("ArticleVersions", fields: [articleId], references: [id], onDelete: Cascade)
  authorId   String
  author     User     @relation("VersionAuthor", fields: [authorId], references: [id])

  version    String                     // "1.0", "1.1", "2.0"
  title      String
  summary    String?
  sections   Section[]
  notes      String?                    // version note / changelog line

  createdAt  DateTime @default(now())

  currentFor Article? @relation("CurrentVersion")
  draftFor   Article? @relation("DraftVersion")

  @@unique([articleId, version])
  @@index([articleId, createdAt])
}

model Section {
  id            String         @id @default(cuid())
  versionId     String
  version       ArticleVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  kind          SectionKind
  title         String
  order         Int
  blocks        Block[]

  @@index([versionId, order])
}

model Block {
  id          String      @id @default(cuid())
  sectionId   String
  section     Section     @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  kind        BlockKind
  order       Int

  // kind=prose, step, callout, checklist: markdown-ish text (TipTap JSON stored as Jsonb)
  content     Json?

  // kind=step
  stepNumber  Int?

  // kind=callout
  calloutVariant CalloutVariant?

  // kind=code
  language    String?
  code        String?

  // kind=image
  imageUrl    String?
  imageAlt    String?

  @@index([sectionId, order])
}

model ArticleTag {
  articleId String
  tagId     String
  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([articleId, tagId])
  @@index([tagId])
}

model Feedback {
  id         String   @id @default(cuid())
  articleId  String
  article    Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  helpful    Boolean
  comment    String?
  createdAt  DateTime @default(now())

  @@index([articleId, createdAt])
}

model IngestionJob {
  id              String      @id @default(cuid())
  articleId       String?     @unique
  article         Article?    @relation(fields: [articleId], references: [id])
  sourceKind      SourceKind
  sourceFileKey   String      // S3 key
  sourceFileName  String
  sizeBytes       Int
  status          JobStatus   @default(queued)
  errorMessage    String?
  startedAt       DateTime?
  finishedAt      DateTime?
  createdById     String
  createdAt       DateTime    @default(now())

  @@index([status, createdAt])
}
```

### 2.1 Indexes & FTS

- `article.searchVector` is maintained by a Postgres trigger that concatenates `title`, `summary`, section titles, and block prose text with weights `A`, `B`, `C`, `D`.
- `GIN` index on `searchVector`.
- Composite `(status, updatedAt DESC)` to serve the Recently Updated view fast.

### 2.2 Soft delete

- v1: hard delete only for drafts; published articles are **archived** (`status=archived`) and never physically deleted. Admin UI exposes archive/unarchive.

---

## 3. Redis layout

| Key / channel                      | Type     | TTL     | Purpose                                    |
|------------------------------------|----------|---------|--------------------------------------------|
| `article:{id}`                     | string   | 300s    | JSON cache of published article            |
| `article:{id}:toc`                 | string   | 300s    | Flattened TOC for the detail view          |
| `article:slug:{slug}`              | string   | 300s    | slug → id lookup                           |
| `search:q:{sha}`                   | string   | 60s     | Cached search results per query hash       |
| `sess:{sid}`                       | hash     | 7d      | Auth.js session                            |
| `csrf:{sid}`                       | string   | 1h      | CSRF tokens                                |
| `views:{articleId}:{yyyymmdd}`     | HLL      | 48h     | Unique daily viewers                       |
| `views:{articleId}:total`          | counter  | ∞       | Lifetime views (synced to Postgres hourly) |
| `jobs:{jobId}:events`              | stream   | 24h     | Progress events for SSE                    |
| `queue:ingest:*`                   | lists    | –       | BullMQ internals                           |
| `rate:{userId}:{bucket}`           | string   | varies  | Rate limiting (login, upload, search)      |

### 3.1 Cache invalidation

- Write path uses tag-based invalidation. On any article write, the server runs:
  - `DEL article:{id}` `article:{id}:toc` `article:slug:{oldSlug}` `article:slug:{newSlug}`
  - `revalidateTag('article:${id}')` for Next.js data cache
  - Scans and deletes `search:q:*` only on publish (search index is already stale-tolerant).

---

## 4. Object storage layout

```
s3://techbase/
  uploads/
    {yyyy}/{mm}/{jobId}/{originalFilename}
  assets/
    hero/{articleId}/{hash}.{ext}
    inline/{articleId}/{hash}.{ext}
  exports/
    pdf/{articleId}/{version}.pdf
```

- Uploads are private; served via signed URLs with 15-minute TTL to the ingestion service only.
- Assets are private; the web app signs URLs per-request for the viewer.
- Exports are time-limited (24h) signed download URLs.

---

## 5. Shared contract — article JSON

This is the shape the Python extractor must produce and the web renderer consumes. Mirrored as a Pydantic model (`services/ingestion/app/schemas/article.py`) and a Zod schema (`apps/web/lib/schemas/article.ts`).

```ts
type ArticleDraft = {
  title: string;
  summary?: string;
  category?: string;        // name; server resolves to id
  tags: string[];           // names
  heroImageUrl?: string;
  sections: Section[];
  source: {
    kind: 'docx' | 'pdf';
    fileName: string;
    jobId: string;
  };
};

type Section =
  | { kind: 'overview'; title: string; blocks: ProseBlock[] }
  | { kind: 'prerequisites'; title: string; blocks: (ChecklistBlock | ProseBlock | CalloutBlock)[] }
  | { kind: 'steps'; title: string; blocks: StepBlock[] }
  | { kind: 'verification'; title: string; blocks: (ChecklistBlock | ProseBlock | CodeBlock)[] }
  | { kind: 'troubleshooting'; title: string; blocks: (CalloutBlock | ProseBlock | CodeBlock)[] }
  | { kind: 'related'; title: string; blocks: (ProseBlock)[] }
  | { kind: 'custom'; title: string; blocks: AnyBlock[] };

type ProseBlock     = { kind: 'prose'; content: TipTapDoc };
type ChecklistBlock = { kind: 'checklist'; items: string[] };
type StepBlock      = { kind: 'step'; number: number; title: string; body: TipTapDoc };
type CalloutBlock   = { kind: 'callout'; variant: 'info'|'important'|'warning'|'success'; title: string; body: TipTapDoc };
type CodeBlock      = { kind: 'code'; language?: string; code: string };
type ImageBlock     = { kind: 'image'; url: string; alt: string };
type AnyBlock       = ProseBlock | ChecklistBlock | StepBlock | CalloutBlock | CodeBlock | ImageBlock;
```

`TipTapDoc` is the standard TipTap ProseMirror JSON. The extractor emits a conservative subset: paragraphs, bold, italic, inline code, hard breaks, lists.

---

## 6. Migrations & seeding

- Migrations: `prisma migrate` (committed per PR).
- Seeds: `prisma/seed.ts` creates:
  - 4 users across the 4 roles.
  - 6 categories (Windows, macOS, Linux, Networking, Security, M365).
  - 20 tags.
  - 20 realistic articles across those categories, each with full section structure.
- No lorem ipsum in seeds. Each article is a plausible IT runbook.
