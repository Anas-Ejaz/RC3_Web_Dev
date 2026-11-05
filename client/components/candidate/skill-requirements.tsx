import { cn } from "@/lib/utils";
import type { Job } from "@/types/api";

interface SkillRequirementsProps {
  title: string;
  skills: Job["required_skills"];
}

export function SkillRequirements({ title, skills }: SkillRequirementsProps) {
  if (skills.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-forest-950">{title}</h3>
      <ul className="mt-3 space-y-2">
        {skills.map((skill) => (
          <li
            key={skill.name}
            className="flex items-center justify-between gap-3 rounded-2xl bg-cream-100 px-4 py-2"
          >
            <span className="text-sm font-medium text-forest-950">{skill.name}</span>
            <span className="flex items-center gap-1" role="img" aria-label={`Importance ${skill.importance} of 5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={cn("h-2 w-2 rounded-full", i < skill.importance ? "bg-lime-dark" : "bg-forest-900/15")}
                />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}