"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Circular face: image when available (stored URL or Gravatar), else initials.
 */
export function UserAvatar({
  name,
  src,
  size = 32,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "?";

  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.375)) }}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Gravatar / arbitrary avatar hosts
        <img
          src={src!}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
