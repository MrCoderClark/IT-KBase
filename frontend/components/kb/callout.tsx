import { TriangleAlert, Info, CircleCheck, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalloutVariant } from "@/lib/types/article";

const VARIANT_STYLES: Record<
  CalloutVariant,
  {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    icon: typeof Info;
  }
> = {
  info: {
    bg: "bg-info-soft",
    border: "border-info/40",
    iconBg: "bg-info/10",
    iconColor: "text-info",
    icon: Info,
  },
  important: {
    bg: "bg-accent-soft",
    border: "border-accent/40",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
    icon: CircleAlert,
  },
  warning: {
    bg: "bg-warning-soft",
    border: "border-warning/40",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    icon: TriangleAlert,
  },
  success: {
    bg: "bg-success-soft",
    border: "border-success/40",
    iconBg: "bg-success/10",
    iconColor: "text-success",
    icon: CircleCheck,
  },
};

/**
 * Tinted callout panel with left border, icon tile, title, and body.
 *
 * Four variants: info, important, warning, success.
 * Matches 02-design-system.md §6.4.
 */
export function Callout({
  variant,
  title,
  children,
  className,
}: {
  variant: CalloutVariant;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const v = VARIANT_STYLES[variant];
  const Icon = v.icon;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border-l-4 p-4",
        v.bg,
        v.border,
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm",
          v.iconBg,
          v.iconColor,
        )}
      >
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] leading-6 font-semibold text-fg">
          {title}
        </div>
        <div className="mt-1 text-[15px] leading-6 break-words text-fg-muted">
          {children}
        </div>
      </div>
    </div>
  );
}
