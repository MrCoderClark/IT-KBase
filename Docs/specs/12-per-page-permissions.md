# 12 — Per-page permissions

A page can **narrow** who may open it. Children **inherit** that rule until a child sets its own. Global roles in `07-security.md` still apply; this layer never grants more than a role already has.

`10-page-tree.md` called this out as deferred. This file is the behavior for that slice. `04-features.md` and `07-security.md` point here.

---

## Problem

Today every signed-in role that may see a given **status** can open every article in that status. The page tree does not cascade visibility. A public child of a private parent stays independently public.

IT teams need a tighter shelf: for example, only reviewers and admins see an incident runbook, and every child under that runbook stays on the same rule unless someone overrides it.

---

## Principles

1. **Narrow only.** A page restriction can hide a page from people who would otherwise see it. It cannot give a reader edit, publish, or admin powers.
2. **Status still wins.** Draft / in review / archived rules from `canReadArticle` stay. A restriction never exposes a draft to a reader.
3. **Admin break-glass.** An admin always passes the page check (lists, search, direct URL, tree).
4. **Inherit by default.** New pages use `inherit`. Moving a page under a restricted parent does not copy fields; effective access is computed from the ancestor chain.
5. **Server is the check.** The UI may hide links; every read path still evaluates effective access.

---

## Who can set a restriction

| Action | reader | author | reviewer | admin |
|--------|:------:|:------:|:--------:|:-----:|
| See effective access on a page they can open | yes | yes | yes | yes |
| Change this page's access mode | | | yes | yes |
| Clear back to inherit / library | | | yes | yes |

Same bar as `article.makePublic` / publish. Authors do not set restrictions on their own drafts in this slice (reviewer or admin does). The server action checks `can(role, "article.publish")`.

---

## Access modes

Stored on `Article`:

| Mode | Meaning |
|------|---------|
| `inherit` | Use the nearest ancestor with a non-`inherit` mode. If every ancestor (and this page) is `inherit`, use **library**. |
| `library` | No page-level narrow. Only the global status/role rules apply (today's behavior). Explicit break from a restricted parent. |
| `role_floor` | Signed-in user must have at least this role. Order: `reader` < `author` < `reviewer` < `admin`. |

Optional field when mode is `role_floor`:

| Field | Type | Notes |
|-------|------|-------|
| `accessRoleFloor` | `Role` | Required when mode is `role_floor`. Ignored otherwise. |

Defaults for every existing and new article: `accessMode = inherit`, `accessRoleFloor = null`.

### Effective mode

Walk from the article up through `parentId` until a node with `accessMode != inherit` is found. That node's mode (and floor) is effective. If the walk ends with only `inherit`, effective mode is `library`.

### Effective view check

A principal may open the article when **both** are true:

1. `canReadArticle(role, userId, article)` (unchanged).
2. Page gate:
   - Admin → pass.
   - Effective `library` → pass.
   - Effective `role_floor` → `roleRank(role) >= roleRank(accessRoleFloor)`.

Anonymous callers never pass the page gate unless the article is still a normal **public** article (`published` + `visibility=public`) **and** effective mode is `library`. A `role_floor` page cannot be anonymous-public.

When a reviewer sets `role_floor` on a public article, the server clears `visibility` to `private` (or refuses the change until they clear public). Prefer: setting a non-library restriction auto-clears `public` and shows a notice.

---

## Inheritance examples

```
Root A          inherit     → effective library
  Child B       role_floor reviewer
    Grand C     inherit     → effective role_floor reviewer (from B)
    Grand D     library     → effective library (explicit break)
  Child E       inherit     → effective library (from A)
```

Moving `Grand C` under `Child E` changes its effective access to library without editing `Grand C`'s row.

---

## Where it is enforced

Same surfaces as today's read rule:

- Article detail (session and public route)
- `/kb` lists, drafts, recent, category/tag lists
- Sidebar page tree (omit nodes the principal cannot open; do not show a locked stub in v1)
- Breadcrumbs (omit ancestors the principal cannot open, or stop the trail at the first visible ancestor — **decision**: show only ancestors the principal can open, left to right)
- Search / `Ctrl+K` / FTS
- Related-articles rail
- Version history and field notes (if they can open the article)

Edit, publish, delete stay on the global matrix. A reviewer who cannot open a `role_floor=admin` page also cannot edit it via URL.

---

## UI

On the article detail **Article Details** card (and the editor metadata rail for reviewer/admin):

- Label: **Page access**
- Control: select — Inherit from parent / Everyone with library access / Role floor…
- When Role floor: second select — Author or above / Reviewer or above / Admin only  
  (`reader` floor is allowed but equal to library for signed-in users; omit it from the control to avoid noise — **decision**: offer Author, Reviewer, Admin only.)
- Helper text when inherit: "Using: Reviewer or above (from *Parent title*)" or "Using: library default"
- Changing the control calls `setArticleAccess(articleId, mode, roleFloor?)` and revalidates.

No bulk tree ACL editor in this slice.

---

## Data model

Add to `Article` (see also `03-data-model.md` when implementing):

```prisma
enum ArticleAccessMode {
  inherit
  library
  role_floor
}

// on Article:
accessMode      ArticleAccessMode @default(inherit)
accessRoleFloor Role?             // set only when accessMode = role_floor
```

No join table in v1. User allowlists are out of scope (below).

Migration: default `inherit` for all rows. Behavior unchanged until someone sets a mode.

---

## Server action

```ts
setArticleAccess(
  articleId: string,
  mode: "inherit" | "library" | "role_floor",
  roleFloor?: "author" | "reviewer" | "admin",
): Promise<{ ok: true } | { ok: false; error: string }>
```

- Requires session + `article.publish`.
- `role_floor` requires `roleFloor`.
- Clears `visibility` to `private` when mode is `role_floor`.
- Revalidates article path, `/kb`, tree layout.
- Writes an audit row when audit list exists (capability later); until then, structured log is enough.

Shared helper:

```ts
effectiveArticleAccess(articleId): { mode; roleFloor; sourceArticleId }
canOpenArticle(role, userId, article): boolean  // status rule ∧ page gate
```

Queries that list articles must apply the page gate in SQL or filter after load. For v1 with a small library, filter after load is acceptable if every list path uses the same helper; push into SQL before the pilot if lists grow.

---

## Edge cases

1. **Restricted parent, public child with `library`:** Child is intentionally open to the library (and can be marked public). Allowed; the break is explicit.
2. **Restricted parent, child `inherit`:** Child stays restricted even if someone marks the child public — refuse public while effective mode is not library, or clear public when saving inherit under a floor parent.
3. **Cycle / missing parent:** Same protections as the page tree. Effective walk is cycle-safe (visited set).
4. **Author of a published restricted page:** Author must still meet the floor (or be admin). Being author does not bypass `role_floor` on **published** pages. Drafts remain author-visible via the status rule only when status is draft/in_review — if a draft sits under a reviewer floor, the author can still open their draft (status rule); once published, the floor applies to them too unless they meet it.
5. **Search snippet leakage:** Do not return hits the principal cannot open.

---

## Build order

1. Schema + migration (`accessMode`, `accessRoleFloor`).
2. `effectiveArticleAccess` + `canOpenArticle`; unit tests for inherit / library / floor walks.
3. Wire article detail, lists, tree, search, related.
4. Reviewer UI on the details card + `setArticleAccess`.
5. Public + restriction interaction (auto-clear public).
6. Update `03-data-model.md` and `07-security.md` capability notes in the same PR as the code.

---

## Not in this slice

- Per-user or per-group allowlists / deny lists.
- Separate edit vs view ACLs (edit stays global-role).
- Space-level or category-level permissions.
- Locked stub rows in the tree for pages you cannot open.
- Guest/external share links beyond existing `visibility=public`.
- Cascading **status** (publish parent does not publish children).
- FastAPI-side page ACL (Python only sees what Next.js already authorized for ingest).

---

## Decisions locked here

| Topic | Decision |
|-------|----------|
| Direction | Narrow only |
| Inherit default | `inherit` → nearest explicit ancestor, else library |
| Explicit opt-out under a restricted parent | `library` |
| Floor values in UI | author / reviewer / admin |
| Who configures | reviewer, admin |
| Admin | always passes page gate |
| Public + floor | floor clears public |
| Allowlists | deferred |
