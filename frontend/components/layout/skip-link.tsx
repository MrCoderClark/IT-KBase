/** First Tab stop — jumps past chrome into the page canvas (WCAG 2.4.1). */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-white focus:shadow-[var(--shadow-focus)] focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
