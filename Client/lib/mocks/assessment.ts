import type { Application, Assessment, Job, ParsedResume, SkillResult } from "@/types/api";
import { daysAgo, db, nextId } from "@/lib/mocks/db";

export function buildAssessment(job: Job, resume: ParsedResume | undefined, prev?: Assessment): Assessment {
  const reqs = [
    ...job.required_skills.map((s) => ({ ...s, required: true })),
    ...job.preferred_skills.map((s) => ({ ...s, required: false })),
  ];

  const skill_results: SkillResult[] = reqs.map((r) => {
    const hit = resume?.skills.find((s) => s.normalized_name.toLowerCase() === r.name.toLowerCase());
    const state = !hit ? "no_evidence_found" : hit.verified ? "confirmed" : "weak_evidence";
    return {
      skill: r.name,
      importance: r.importance,
      required: r.required,
      state,
      similarity: !hit ? 0.12 : hit.verified ? 0.92 : 0.58,
      evidence_excerpt: hit?.evidence_excerpt,
    };
  });

  const total = skill_results.reduce((a, r) => a + r.importance, 0) || 1;
  const earned = skill_results.reduce(
    (a, r) => a + r.importance * (r.state === "confirmed" ? 1 : r.state === "weak_evidence" ? 0.5 : 0),
    0,
  );
  const skills = Math.round((earned / total) * 100);
  const years = resume?.experience.reduce((a, e) => a + e.years, 0) ?? 0;
  const experience = Math.min(100, Math.round((years / Math.max(job.min_experience_years, 1)) * 100));
  const projects = Math.min(100, (resume?.projects.length ?? 0) * 45);
  const qualifications = resume?.education.length ? 85 : 30;
  const overall = Math.round(skills * 0.5 + experience * 0.25 + projects * 0.15 + qualifications * 0.1);

  const missing = skill_results.filter((r) => r.state === "no_evidence_found").map((r) => r.skill);
  const weak = skill_results.filter((r) => r.state === "weak_evidence").map((r) => r.skill);

  return {
    overall_score: overall,
    overridden: prev?.overridden ?? false,
    override_score: prev?.override_score,
    override_reason: prev?.override_reason,
    breakdown: {
      skills: { score: skills, weight: 0.5 },
      experience: { score: experience, weight: 0.25 },
      projects: { score: projects, weight: 0.15 },
      qualifications: { score: qualifications, weight: 0.1 },
    },
    skill_results,
    gaps: missing.map((m) => `No evidence of ${m} was found in the resume.`),
    learning_suggestions: [...missing, ...weak].map((m) => `Hands-on project work with ${m} would strengthen the evidence.`),
    explanation: `Overall fit is ${overall}%. Skills are weighted most heavily. ${
      missing.length ? `No evidence found yet for: ${missing.join(", ")}. This may be missing from the resume rather than missing from the candidate. ` : ""
    }${weak.length ? `Weak evidence for: ${weak.join(", ")}.` : ""}`.trim(),
    unsupported_claims: resume?.unsupported_claims ?? [],
    generated_at: new Date().toISOString(),
  };
}

export function seedApplications() {
  [2, 3, 4].forEach((candidateId, i) => {
    const user = db.users.find((u) => u.id === candidateId)!;
    const job = db.jobs[0];
    const app: Application = {
      id: i + 1,
      job_id: job.id,
      candidate_id: candidateId,
      candidate_name: user.full_name,
      status: "ai_assessment_available",
      assessment: buildAssessment(job, db.resumes[candidateId]),
      submitted_at: daysAgo(5 - i),
      updated_at: daysAgo(4 - i),
    };
    db.applications.push(app);
    db.audit[app.id] = [
      { from_status: null, to_status: "submitted", changed_by: "System", created_at: daysAgo(5 - i) },
      { from_status: "submitted", to_status: "parsed", changed_by: "System", created_at: daysAgo(5 - i) },
      { from_status: "parsed", to_status: "ai_assessment_available", changed_by: "System", created_at: daysAgo(4 - i) },
    ];
    db.notes[app.id] = [];
  });
  void nextId;
}