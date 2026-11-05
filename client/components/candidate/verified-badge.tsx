import { BadgeCheck, CircleHelp } from "lucide-react";

import { cn } from "@/lib/utils";

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        verified
          ? "bg-lime-soft text-forest-950"
          : "border border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {verified ? (
        <BadgeCheck className="h-3 w-3" aria-hidden />
      ) : (
        <CircleHelp className="h-3 w-3" aria-hidden />
      )}
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}