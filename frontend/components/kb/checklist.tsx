import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Green-check checklist rendered on a soft panel.
 * Used in Prerequisites and Verification sections.
 */
export function Checklist({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CircleCheck
            size={20}
            className="mt-0.5 shrink-0 text-success"
            aria-hidden
          />
          <span className="text-[15px] leading-6 text-fg">{item}</span>
        </li>
      ))}
    </ul>
  );
}
