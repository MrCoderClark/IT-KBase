"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Counts this open once per viewer per UTC day, then refreshes the shown total. */
export function RecordArticleView({ articleId }: { articleId: string }) {
  const router = useRouter();
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void fetch(`/api/articles/${articleId}/view`, { method: "POST" }).then((response) => {
      // A shared ref, not a local flag: dev Strict Mode runs this effect twice,
      // and the first request is the one that returns 201.
      if (mounted.current && response.status === 201) router.refresh();
    });
    return () => {
      mounted.current = false;
    };
  }, [articleId, router]);

  return null;
}
