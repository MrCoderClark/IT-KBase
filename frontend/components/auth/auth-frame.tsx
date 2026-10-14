import Link from "next/link";

export const authFieldClass =
  "mt-1.5 h-10 w-full rounded-sm border border-border-strong bg-surface px-3 text-[14px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function AuthFrame({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
      <aside
        className="flex flex-col justify-between px-8 py-10 text-white"
        style={{
          background: "linear-gradient(180deg, #0B1220 0%, #0F172A 100%)",
        }}
      >
        <div>
          <p className="text-[13px] font-semibold tracking-wide text-white/70">TechBase</p>
          <h1 className="mt-6 text-[28px] leading-8 font-semibold">IT Knowledge Hub</h1>
          <p className="mt-3 max-w-xs text-[14px] leading-6 text-white/70">
            Sign in to read and edit runbooks.
          </p>
        </div>
        <p className="text-[12px] text-white/50">Internal use</p>
      </aside>

      <main className="flex items-center justify-center bg-canvas px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="text-[20px] font-semibold text-fg">{title}</h2>
          <p className="mt-1 text-[14px] text-fg-muted">{lede}</p>
          {children}
          <p className="mt-6 text-[13px]">
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
