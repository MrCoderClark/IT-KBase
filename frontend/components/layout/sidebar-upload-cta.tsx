import Link from "next/link";
import { FileText } from "lucide-react";

/**
 * The "Turn documents into knowledge" card pinned to the bottom of the sidebar.
 * Signature element — the small cobalt-to-indigo gradient button is one of the
 * only places we allow a gradient on an interactive element.
 */
export function SidebarUploadCta() {
  return (
    <div
      className="rounded-xl border border-white/[0.08] p-4 shadow-md backdrop-blur"
      style={{
        background:
          "linear-gradient(180deg, rgba(30,107,255,0.08), rgba(30,107,255,0.03))",
      }}
    >
      <div
        className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-sm text-white"
        style={{
          background: "linear-gradient(135deg, #2E74FF 0%, #6B46FF 100%)",
          boxShadow: "0 4px 12px rgba(46,116,255,0.35)",
        }}
      >
        <FileText size={18} aria-hidden />
      </div>

      <div className="text-[13.5px] leading-5 font-semibold text-white">
        Turn documents into knowledge
      </div>
      <p className="mt-1.5 text-[12px] leading-[18px] text-sidebar-fg/80">
        Upload a Word document or a PDF and turn it into a draft article you can edit.
      </p>

      <Link
        href="/import"
        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-sm text-[13px] font-semibold text-white transition-opacity hover:opacity-95"
        style={{
          background: "linear-gradient(135deg, #2E74FF 0%, #6B46FF 100%)",
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.3), 0 6px 16px rgba(46,116,255,0.35)",
        }}
      >
        Upload File
      </Link>
    </div>
  );
}
