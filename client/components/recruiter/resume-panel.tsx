import type { ReactNode } from "react";

import { SectionCard } from "@/components/candidate/section-card";
import { VerifiedBadge } from "@/components/candidate/verified-badge";
import { SkillsCorrection } from "@/components/recruiter/skills-correction";
import { EmptyState } from "@/components/shared/states";
import { EvidenceExcerpt } from "@/components/shared/evidence-excerpt";
import type { ParsedResume } from "@/types/api";

function Entry({ title, subtitle, evidence, children }: { title: string; subtitle?: string; evidence: string; children?: ReactNode }) {
    return (
        <li className="rounded-2xl border border-forest-900/10 bg-cream-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="font-medium text-forest-950">{title}</h3>
                    {subtitle && <p className="text-sm text-forest-900/70">{subtitle}</p>}
                </div>
                <VerifiedBadge verified={evidence.trim().length > 0} />
            </div>
            {children}
            {evidence && (
                <div className="mt-3">
                    <EvidenceExcerpt excerpt={evidence} collapsible />
                </div>
            )}
        </li>
    );
}

export function ResumePanel({ applicationId, resume }: { applicationId: number; resume: ParsedResume }) {
    if (resume.parse_status !== "parsed") {
        return (
            <EmptyState
                title="Resume not available"
                description="This resume couldn't be read, so there is nothing to show yet."
            />
        );
    }

    return (
        <div className="space-y-6">
            <SectionCard title="Contact">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-forest-900/60">Name</dt>
                        <dd className="font-medium text-forest-950">{resume.name}</dd>
                    </div>
                    <div>
                        <dt className="text-forest-900/60">Email</dt>
                        <dd className="font-medium text-forest-950">{resume.email}</dd>
                    </div>
                    <div>
                        <dt className="text-forest-900/60">Phone</dt>
                        <dd className="font-medium text-forest-950">{resume.phone || "Not provided"}</dd>
                    </div>
                    <div>
                        <dt className="text-forest-900/60">Links</dt>
                        <dd className="font-medium text-forest-950">{resume.links.length > 0 ? resume.links.join(", ") : "None"}</dd>
                    </div>
                </dl>
            </SectionCard>

            <SkillsCorrection
                key={resume.skills.map((s) => s.normalized_name).join("|")}
                applicationId={applicationId}
                skills={resume.skills}
            />


            <SectionCard title="Experience">
                {resume.experience.length === 0 ? (
                    <p className="text-sm text-forest-900/70">No experience found.</p>
                ) : (
                    <ul className="space-y-4">
                        {resume.experience.map((item, i) => (
                            <Entry
                                key={`${item.title}-${item.company}-${i}`}
                                title={item.title}
                                subtitle={`${item.company} · ${item.start} to ${item.end} · ${item.years} years`}
                                evidence={item.evidence_excerpt}
                            >
                                {item.summary && <p className="mt-2 text-sm text-forest-950">{item.summary}</p>}
                            </Entry>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <SectionCard title="Education">
                {resume.education.length === 0 ? (
                    <p className="text-sm text-forest-900/70">No education found.</p>
                ) : (
                    <ul className="space-y-4">
                        {resume.education.map((item, i) => (
                            <Entry
                                key={`${item.degree}-${item.institution}-${i}`}
                                title={item.degree}
                                subtitle={`${item.institution} · ${item.year}`}
                                evidence={item.evidence_excerpt}
                            />
                        ))}
                    </ul>
                )}
            </SectionCard>

            <SectionCard title="Projects">
                {resume.projects.length === 0 ? (
                    <p className="text-sm text-forest-900/70">No projects found.</p>
                ) : (
                    <ul className="space-y-4">
                        {resume.projects.map((item, i) => (
                            <Entry
                                key={`${item.name}-${i}`}
                                title={item.name}
                                subtitle={item.technologies.join(", ")}
                                evidence={item.evidence_excerpt}
                            >
                                {item.description && <p className="mt-2 text-sm text-forest-950">{item.description}</p>}
                            </Entry>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}