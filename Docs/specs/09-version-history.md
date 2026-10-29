# 09 — Article version history

The first Confluence-like feature for TechBase. An article stays a runbook. History lets a reviewer see what changed, and lets an admin put a known version back.

This file is the behavior for that slice. `04-features.md` F11 points here.

## Already true

Every editor save inserts an `ArticleVersion` and sets `Article.currentVersionId` to it. The version string comes from `nextArticleVersion`: the first save is `1.0`, a later save bumps the minor number, and a major publish resets the minor number (`1.4` → `2.0`). Sections and blocks belong to that version row. The note is `Published from the editor` or `Saved from the editor`.

`article.rollback` is admin-only. A reviewer can publish. Settings stores `versionRetentionDays`. A daily job (`GET /api/cron/purge-versions`, Bearer `CRON_SECRET`) and Settings → Run retention now delete versions older than that window. Rows pointed at by `currentVersionId` or `draftVersionId` are never removed.

Each save creates new section and block ids. A later version does not reuse the previous block id, so a diff cannot yet tell a move from a delete plus an insert.

## Who

| Action | reader | author | reviewer | admin |
|---|:---:|:---:|:---:|:---:|
| See the current version string on the article | yes | yes | yes | yes |
| Open history and read an older version | | | yes | yes |
| Restore an older version | | | | yes |

The server action checks `can()`. Hiding the link is not the check. An author who opens the history URL is turned away.

## History page

From the article, the version in the details rail links to `/kb/[slug]/history`.

The page lists every `ArticleVersion` for that article, newest first. Each row shows the version string, author, time, and note. The row that `currentVersionId` points at is marked Current.

Choosing a row opens that version in the normal article layout, with a banner: `Viewing 1.2. Current is 1.4.` That view has no Edit button. The banner links back to the current article and to the history list.

## Compare

Compare is the current version on the left and the selected version on the right.

The unit is a section, in `order`. The text is the section title plus the plain text of its blocks (prose, step body, callout, checklist, and code). A section is unchanged, changed, only on the left, or only on the right. This slice does not paint a character diff inside a block, and it does not call a move a move.

## Restore

An admin restores from the history page. Restore:

1. Copies the selected version's title, summary, sections, and blocks into a new `ArticleVersion`.
2. Sets that row's version string with a minor bump from the current string.
3. Sets the note to `Restored from 1.2`.
4. Points `currentVersionId` at the new row.
5. Leaves status, visibility, category, tags, and the older rows as they are.

The restored article is the new current version. The history still contains the version that was restored and every version since.

Restore refuses a version that is already current, and refuses a version that belongs to another article.

## Build order

1. History list and a read-only older version.
2. Section compare.
3. Restore.

## Not in this slice

- A character-level diff, or treating a moved block as a move.
- Comments, a page tree, or a permission grant on one article.
- Authors and readers browsing history.
