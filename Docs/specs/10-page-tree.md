# 10 — Page tree

The second Confluence-like feature. Articles can now have a parent, forming a hierarchy. The sidebar shows a collapsible tree instead of a flat list. Per-page access inheritance is specified in [`12-per-page-permissions.md`](12-per-page-permissions.md).

This file is the behavior for that slice. `04-features.md` will point here once the feature lands.

---

## Data model

Add to `Article`:

| Field | Type | Notes |
|-------|------|-------|
| `parentId` | `String?` | FK to another Article. `null` = root-level. |
| `order` | `Int` | Sort order among siblings. Starts at 0. |

Constraints:
- An article cannot be its own parent.
- An article cannot have a parent that is one of its descendants (no cycles).
- `parentId` must reference a published or draft article in the same tenant (when multi-tenant lands).
- Deleting a parent does not cascade — children become root-level (or block delete if children exist, TBD).

Migration adds `parentId` and `order` columns, both nullable, defaulting existing articles to root-level with `order = 0`.

---

## Who can do what

| Action | reader | author | reviewer | admin |
|--------|:------:|:------:|:--------:|:-----:|
| See the tree in the sidebar | yes | yes | yes | yes |
| Expand / collapse nodes | yes | yes | yes | yes |
| Move an article (change parent or reorder) | | | yes | yes |
| Create a child page | | yes | yes | yes |

The server action checks `can()`. Dragging in the UI is not the check.

---

## Sidebar tree

Replace the flat "All Articles" list in the Knowledge Base section with a tree.

### Structure
- Root-level articles appear at depth 0.
- Each node shows the article title. Clicking navigates to `/kb/[slug]`.
- A node with children has a disclosure chevron. Click the chevron to expand/collapse. Click the title to navigate.
- Expansion state persists in `localStorage` per user.

### Ordering
- Siblings are sorted by `order` ascending.
- A reviewer or admin can drag a node to reorder siblings or re-parent.
- Drag feedback: a drop indicator line between nodes for reorder, or a highlight on a node for "make child of."
- Drop calls a server action that updates `parentId` and/or `order` for the moved article (and adjusts sibling orders).

### Lazy loading (optional, defer if <100 articles)
- Initially load only root-level + first two depths.
- Expanding a node that hasn't loaded its children fetches them.
- For MVP with <100 articles, load the full tree on the Knowledge Base layout and filter client-side.

---

## Creating a child page

From an article's overflow menu (or a "+ Add child" action), create a new draft as a child of this article.

- The new article's `parentId` = current article's id.
- The new article's `order` = max sibling order + 1.
- Navigates to `/create?parentId=...` or directly to the new draft's edit page.

---

## Article detail: breadcrumbs

If an article has ancestors, the breadcrumb shows the lineage:

```
Knowledge Base > Parent Title > Grandparent Title > This Article
```

Each ancestor is a link. The breadcrumb replaces the current flat "Knowledge Base > Articles."

---

## Moving and reordering

### Drag-and-drop in sidebar
- Drag a node onto another node → becomes last child of that node.
- Drag a node between two nodes → reorder among siblings.
- Drag a root node under another → becomes child.
- Drag a child to root level → becomes root. While dragging, the tree shows **Move to top of library** and **Move to end of library** strips; dropping before/after a root sibling also promotes to root.
- After every move, sibling `order` values in the affected parent groups are rewritten `0..n` so reorder stays stable.

### Server action: `moveArticle`

```ts
moveArticle(articleId: string, newParentId: string | null, newOrder: number)
```

- Validates no cycle would be created.
- Updates `parentId`.
- Reorders siblings: articles at `order >= newOrder` in the new parent get `order += 1`.
- Sets moved article's `order = newOrder`.
- Returns updated tree or refetch signal.

---

## Edge cases

1. **Deleting a parent**: Options:
   - (a) Block delete if article has children. User must move children first.
   - (b) Promote children to root level on delete.
   - **Decision**: (a) for now — block delete, show error "Move or delete child pages first."

2. **Archiving a parent**: Children remain visible. The archived parent shows in the tree as grayed/italic but is not navigable (or navigates to an "archived" notice). Revisit when archive behavior is more defined.

3. **Visibility mismatch**: A public child of a private parent is still public until page access is set. Effective access and public+restriction rules are in [`12-per-page-permissions.md`](12-per-page-permissions.md).

4. **Deep nesting**: No hard limit, but UI may truncate or indent less aggressively past depth 5. Warn in the editor if depth > 5.

---

## Build order

1. **Schema + migration**: Add `parentId` and `order` to Article.
2. **Tree query**: Fetch articles with parent relationships, build nested structure.
3. **Sidebar tree UI**: Render collapsible tree, persist expansion state.
4. **Breadcrumbs**: Show ancestor chain on article detail.
5. **Drag-and-drop reorder**: Reviewer/admin can move nodes.
6. **Create child**: Add child page action from article.

---

## Not in this slice

- Per-page permissions — see [`12-per-page-permissions.md`](12-per-page-permissions.md) (implement in that slice).
- Cascading status (publish parent ≠ publish children).
- Archiving behavior for trees.
- Lazy loading (defer until >100 articles).
- Tree view in the main content area (keep sidebar-only for now).
