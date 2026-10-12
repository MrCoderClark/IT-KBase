/**
 * TechBase brand mark — isometric cobalt polyhedron with inner-face lighting.
 * Pure SVG, no runtime deps. Server-renderable.
 *
 * Rendering rules (from Docs/specs/02-design-system.md §7):
 *   - Always shows the inner-face highlight (two gradients).
 *   - Minimum size 20px.
 *   - Stroke-less; relies on gradients + alpha for depth.
 *
 * Each instance generates unique gradient ids so multiple marks on one page
 * do not collide (e.g. header + favicon preview + splash).
 */

import { useId } from "react";

type Props = {
  size?: number;
  className?: string;
  /** Accessible label. If omitted, the mark is `aria-hidden`. */
  title?: string;
};

export function BrandMark({ size = 32, className, title }: Props) {
  const uid = useId().replace(/:/g, "");
  const gTop = `tb-brand-top-${uid}`;
  const gLeft = `tb-brand-left-${uid}`;
  const gRight = `tb-brand-right-${uid}`;
  const gInner = `tb-brand-inner-${uid}`;

  const labelled = Boolean(title);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? title : undefined}
    >
      {labelled ? <title>{title}</title> : null}

      <defs>
        {/* Top face — brightest, picks up the "light source" above */}
        <linearGradient id={gTop} x1="20" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5B8CFF" />
          <stop offset="100%" stopColor="#2E74FF" />
        </linearGradient>
        {/* Left face — the darker side */}
        <linearGradient id={gLeft} x1="4" y1="10" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E4FD6" />
          <stop offset="100%" stopColor="#0F2C8C" />
        </linearGradient>
        {/* Right face — mid-tone cobalt */}
        <linearGradient id={gRight} x1="20" y1="12" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2E74FF" />
          <stop offset="100%" stopColor="#1A4FD2" />
        </linearGradient>
        {/* Inner highlight — the signature "inner-face lighting" */}
        <linearGradient id={gInner} x1="20" y1="10" x2="20" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Left face */}
      <path d="M4 11.5 L20 20 L20 38 L4 29.5 Z" fill={`url(#${gLeft})`} />
      {/* Right face */}
      <path d="M36 11.5 L20 20 L20 38 L36 29.5 Z" fill={`url(#${gRight})`} />
      {/* Top face */}
      <path d="M20 2 L36 11.5 L20 20 L4 11.5 Z" fill={`url(#${gTop})`} />

      {/* Inner highlight — small inset diamond on the top face */}
      <path
        d="M20 7 L31.5 13.5 L20 20 L8.5 13.5 Z"
        fill={`url(#${gInner})`}
        style={{ mixBlendMode: "screen" }}
      />

      {/* Hairline edge on the top face to crisp it up */}
      <path
        d="M20 2 L36 11.5 L20 20 L4 11.5 Z"
        stroke="#8FB2FF"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
    </svg>
  );
}
