import { CheckCircle2, CircleDashed, HelpCircle } from "lucide-react";
import { EVIDENCE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { EvidenceState } from "@/types/api";

const STYLE: Record<EvidenceState, { cls: string; Icon: typeof CheckCircle2 }> = {
  confirmed: { cls: "bg-evidence-confirmed-bg text-evidence-confirmed-fg border-evidence-confirmed-border", Icon: CheckCircle2 },
  weak_evidence: { cls: "bg-evidence-weak-bg text-evidence-weak-fg border-evidence-weak-border", Icon: CircleDashed },
  no_evidence_found: { cls: "bg-evidence-none-bg text-evidence-none-fg border-evidence-none-border", Icon: HelpCircle },
};

interface SkillBadgeProps {
  name?: string;
  state: EvidenceState;
  showLabel?: boolean;
  className?: string;
}

/** Evidence-state badge. Never red, never "lacks". */
export function SkillBadge({ name, state, showLabel = true, className }: SkillBadgeProps) {
  const { cls, Icon } = STYLE[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", cls, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {name && <span>{name}</span>}
      {showLabel && <span className={cn(name && "opacity-75")}>{name ? `· ${EVIDENCE_LABEL[state]}` : EVIDENCE_LABEL[state]}</span>}
    </span>
  );
}