# 11 — Field notes

A signed-in person can leave a note on an article after running the procedure. The note is about the whole article. It is not a helpful vote, and it is not a comment attached to a paragraph.

`04-features.md` F12 points here.

## Who

| Action | reader | author | reviewer | admin |
|---|:---:|:---:|:---:|:---:|
| Read notes on an article they can open | yes | yes | yes | yes |
| Post a note | yes | yes | yes | yes |
| Delete their own note | yes | yes | yes | yes |
| Delete someone else's note | | | | yes |

The server action checks `can()`. Hiding the form is not the check. A person who is not signed in does not see notes, including on a public article.

## The list

Notes sit under the article body, oldest first. Each row shows the author, the time, and the text.

The form asks what happened when they ran it. Empty text is refused. Text longer than 2,000 characters is refused.

## Not in this slice

- Replies, @mentions, or a note pinned to one step.
- Editing a note after it is posted.
- Notes on the anonymous public view.
