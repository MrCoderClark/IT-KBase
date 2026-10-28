"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setArticleAccess } from "@/lib/actions/article-access";
import {
  accessFloorLabel,
  type AccessRoleFloor,
  type ArticleAccessMode,
  type EffectivePageAccess,
  effectiveAccessLabel,
} from "@/lib/kb/page-access";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] leading-5 text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30";

/**
 * Reviewer/admin control for per-page access on the details card.
 */
export function PageAccessControl({
  articleId,
  mode,
  roleFloor,
  effective,
  canManage,
}: {
  articleId: string;
  mode: ArticleAccessMode;
  roleFloor: AccessRoleFloor | null;
  effective: EffectivePageAccess;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState<ArticleAccessMode>(mode);
  const [localFloor, setLocalFloor] = useState<AccessRoleFloor>(roleFloor ?? "reviewer");

  function save(nextMode: ArticleAccessMode, nextFloor: AccessRoleFloor) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setArticleAccess(
        articleId,
        nextMode,
        nextMode === "role_floor" ? nextFloor : null,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.clearedPublic) {
        setNotice("Public access was cleared because this page now has a role floor.");
      }
      router.refresh();
    });
  }

  if (!canManage) {
    return (
      <div>
        <p className="text-[12px] font-medium text-fg-muted">Page access</p>
        <p className="mt-0.5 text-[13px] text-fg">{effectiveAccessLabel(effective)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-[12px] font-medium text-fg-muted" htmlFor="page-access-mode">
        Page access
      </label>
      <select
        id="page-access-mode"
        className={fieldClass}
        value={localMode}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as ArticleAccessMode;
          setLocalMode(next);
          save(next, localFloor);
        }}
      >
        <option value="inherit">Inherit from parent</option>
        <option value="library">Everyone with library access</option>
        <option value="role_floor">Role floor…</option>
      </select>
      {localMode === "role_floor" ? (
        <select
          aria-label="Minimum role"
          className={fieldClass}
          value={localFloor}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value as AccessRoleFloor;
            setLocalFloor(next);
            save("role_floor", next);
          }}
        >
          <option value="author">{accessFloorLabel("author")}</option>
          <option value="reviewer">{accessFloorLabel("reviewer")}</option>
          <option value="admin">{accessFloorLabel("admin")}</option>
        </select>
      ) : null}
      <p className="text-[12px] text-fg-subtle">
        {localMode === "inherit"
          ? `Using: ${effectiveAccessLabel(effective)}`
          : localMode === "library"
            ? "This page ignores parent restrictions."
            : `Requires ${accessFloorLabel(localFloor)}. Children inherit until they override.`}
      </p>
      {notice ? <p className="text-[12px] text-fg-muted">{notice}</p> : null}
      {error ? (
        <p className="text-[12px] font-medium text-warning" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
