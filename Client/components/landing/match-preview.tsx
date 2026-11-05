import { initials } from "@/lib/utils";
import { ScoreCard } from "@/components/shared/score-card";
import { SkillBadge } from "@/components/shared/skill-badge";
import type { Assessment, EvidenceState } from "@/types/api";

// Illustrative marketing sample, not API data.
const SAMPLE_SKILLS: { name: string; state: EvidenceState }[] = [
  { name: "Python", state: "confirmed" },
  { name: "Django", state: "confirmed" },
  { name: "PostgreSQL", state: "weak_evidence" },
  { name: "Docker", state: "no_evidence_found" },
];

const SAMPLE_BREAKDOWN: Assessment["breakdown"] = {
  skills: { score: 92, weight: 0.5 },
  experience: { score: 85, weight: 0.25 },
  projects: { score: 80, weight: 0.15 },
  qualifications: { score: 90, weight: 0.1 },
};

const SAMPLE_MINI = [
  { label: "Skills", value: 98 },
  { label: "Experience", value: 95 },
  { label: "Projects", value: 92 },
];

export function MatchPreview() {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-cream-50/15 bg-cream-50/10 p-5 text-cream-50 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm text-cream-50/70">Evidence check</p>
            <span className="rounded-full bg-cream-50/15 px-2.5 py-0.5 text-xs">Sample</span>
          </div>
          <p className="mt-1 text-lg font-medium">Backend Developer</p>
          <ul className="mt-4 space-y-2.5">
            {SAMPLE_SKILLS.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2">
                <span className="text-sm">{s.name}</span>
                <SkillBadge state={s.state} />
              </li>
            ))}
          </ul>
        </div>

        <ScoreCard score={88} label="Overall match" subtitle="Sample candidate" breakdown={SAMPLE_BREAKDOWN} />

        <div className="rounded-3xl bg-lime p-5 text-forest-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Candidate match</p>
            <span className="rounded-full bg-forest-900 px-2.5 py-0.5 text-xs text-cream-50">Human reviewed</span>
          </div>
          <p className="mt-2 text-6xl font-semibold leading-none tracking-tight">
            96<span className="text-3xl">%</span>
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            {SAMPLE_MINI.map((m) => (
              <div key={m.label} className="rounded-xl bg-forest-900/10 p-2">
                <dt className="text-xs">{m.label}</dt>
                <dd className="text-sm font-semibold">{m.value}%</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex items-center gap-3 border-t border-forest-900/15 pt-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-forest-900 text-sm font-semibold text-lime">
              {initials("Maya Chen")}
            </span>
            <div>
              <p className="text-sm font-medium">Maya Chen</p>
              <p className="text-xs text-forest-800">Backend Developer</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-cream-50/50">Sample data for illustration.</p>
    </div>
  );
}