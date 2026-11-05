import { Info } from "lucide-react";

import { AI_NOTICE } from "@/lib/constants";

export function AiNotice() {
  return (
    <p
      role="note"
      className="flex items-center gap-2 rounded-2xl border border-forest-900/10 bg-cream-100 px-4 py-3 text-sm text-forest-950"
    >
      <Info className="h-4 w-4 shrink-0" aria-hidden />
      {AI_NOTICE}
    </p>
  );
}