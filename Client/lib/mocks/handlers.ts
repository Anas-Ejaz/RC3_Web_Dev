import { delay, http, HttpResponse, type DefaultBodyType, type PathParams, type StrictRequest } from "msw";
import type {
  Application,
  ApplicationStatus,
  Difficulty,
  FairnessAttribute,
  Interview,
  InterviewFeedback,
  InterviewInput,
  InterviewQuestion,
  Job,
  JobInput,
  ParsedResume,
  QuestionGenerateInput,
  ResumeCorrections,
  ResumeSkill,
  Role,
  User,
} from "@/types/api";
import { buildAssessment, seedApplications } from "@/lib/mocks/assessment";
import { daysAgo, db, nextId, SAMPLE_RESUME, SESSION_KEY, type MockUser } from "@/lib/mocks/db";

const B = "/api/v1";

type Ctx = { request: StrictRequest<DefaultBodyType>; params: PathParams };

const err = (status: number, detail: string, code: string, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ detail, code, ...extra }, { status });

const h =
  (fn: (c: Ctx) => Response | Promise<Response>) =>
  async (c: Ctx) => {
    await delay(180);
    return fn(c);
  };

const body = <T>(c: Ctx) => c.request.json() as Promise<T>;
const pid = (c: Ctx) => Number(c.params.id);
const strip = ({ password: _p, ...u }: MockUser): User => u;

function currentUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  const id = Number(localStorage.getItem(SESSION_KEY));
  return db.users.find((u) => u.id === id) ?? null;
}

function guard(role?: Role): MockUser | Response {
  const u = currentUser();
  if (!u) return err(401, "Not authenticated", "UNAUTHENTICATED");
  if (role && u.role !== role) return err(403, "You do not have access to this resource", "FORBIDDEN");
  return u;
}
const isRes = (x: unknown): x is Response => x instanceof Response;

function paginate<T>(items: T[], url: URL) {
  const page = Number(url.searchParams.get("page") ?? 1);
  const page_size = Number(url.searchParams.get("page_size") ?? 20);
  return { items: items.slice((page - 1) * page_size, page * page_size), total: items.length, page, page_size };
}

const withCount = (j: Job): Job => ({
  ...j,
  applicant_count: db.applications.filter((a) => a.job_id === j.id).length,
});

const touch = (app: Application, to: ApplicationStatus, by: string, reason?: string) => {
  (db.audit[app.id] ??= []).push({
    from_status: app.status,
    to_status: to,
    changed_by: by,
    reason,
    created_at: new Date().toISOString(),
  });
  app.status = to;
  app.updated_at = new Date().toISOString();
};

const notify = (message: string) =>
  db.notifications.unshift({ id: nextId(), message, created_at: new Date().toISOString(), read: false });

const candidateSafe = (a: Application): Application => ({
  id: a.id,
  job_id: a.job_id,
  candidate_id: a.candidate_id,
  candidate_name: a.candidate_name,
  status: a.status,
  submitted_at: a.submitted_at,
  updated_at: a.updated_at,
  job_title: db.jobs.find((j) => j.id === a.job_id)?.title,
});

const getApp = (id: number) => db.applications.find((a) => a.id === id);

const SKILL_BANK = ["Python", "Django", "PostgreSQL", "Docker", "Redis", "React", "TypeScript", "SQL", "Kubernetes", "AWS", "FastAPI", "Git", "REST", "Celery", "Tailwind CSS"];
const REQ_PHRASES = ["REST API", "REST"];

seedApplications();

export const handlers = [
  // ---------- AUTH ----------
  http.post(`${B}/auth/register`, h(async (c) => {
    const b = await body<{ email: string; password: string; full_name: string; role: Role }>(c);
    if (db.users.some((u) => u.email === b.email))
      return err(409, "Email already registered", "EMAIL_EXISTS", { fields: { email: "Email already registered" } });
    const u: MockUser = { id: nextId(), ...b };
    db.users.push(u);
    localStorage.setItem(SESSION_KEY, String(u.id));
    return HttpResponse.json(strip(u), { status: 201 });
  })),
  http.post(`${B}/auth/login`, h(async (c) => {
    const b = await body<{ email: string; password: string }>(c);
    const u = db.users.find((x) => x.email === b.email && x.password === b.password);
    if (!u) return err(401, "Invalid email or password", "INVALID_CREDENTIALS");
    localStorage.setItem(SESSION_KEY, String(u.id));
    return HttpResponse.json(strip(u));
  })),
  http.post(`${B}/auth/logout`, h(() => {
    localStorage.removeItem(SESSION_KEY);
    return new HttpResponse(null, { status: 204 });
  })),
  http.get(`${B}/auth/me`, h(() => {
    const u = guard();
    return isRes(u) ? u : HttpResponse.json(strip(u));
  })),

  // ---------- JOBS ----------
    http.get(`${B}/jobs`, h(({ request }) => {
    const u = currentUser(); // public endpoint: visitors and candidates see open jobs only
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase();
    const location = url.searchParams.get("location")?.toLowerCase();
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    let items = db.jobs.map(withCount);
    if (!u || u.role === "candidate") items = items.filter((j) => j.status === "open");
    else if (status) items = items.filter((j) => j.status === status);
    if (q) items = items.filter((j) => `${j.title} ${j.description} ${j.department}`.toLowerCase().includes(q));
    if (location) items = items.filter((j) => j.location.toLowerCase().includes(location));
    if (type) items = items.filter((j) => j.type === type);
    return HttpResponse.json(paginate(items, url));
  })),
  
  http.post(`${B}/jobs/extract-requirements`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const { description } = await body<{ description: string }>(c);
    const lower = description.toLowerCase();
    const found = SKILL_BANK.filter((s) => lower.includes(s.toLowerCase()));
    const preferredIdx = lower.indexOf("plus");
    const required = found.filter((s) => preferredIdx < 0 || lower.indexOf(s.toLowerCase()) < preferredIdx);
    const preferred = found.filter((s) => !required.includes(s));
    const yrs = description.match(/(\d+)\+?\s*years?/i);
    void REQ_PHRASES;
    return HttpResponse.json({
      required_skills: required.map((name, i) => ({ name, importance: Math.max(2, 5 - Math.floor(i / 2)) })),
      preferred_skills: preferred.map((name) => ({ name, importance: 2 })),
      min_experience_years: yrs ? Number(yrs[1]) : 0,
      qualifications: lower.includes("degree") || lower.includes("bs ") ? ["Relevant degree"] : [],
    });
  })),
  http.post(`${B}/jobs`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const b = await body<JobInput>(c);
    const job: Job = { ...b, id: nextId(), status: "open", applicant_count: 0, created_at: new Date().toISOString() };
    db.jobs.unshift(job);
    return HttpResponse.json(job, { status: 201 });
  })),
  http.get(`${B}/jobs/:id`, h((c) => {
    const u = guard();
    if (isRes(u)) return u;
    const job = db.jobs.find((j) => j.id === pid(c));
    if (!job) return err(404, "Job not found", "NOT_FOUND");
    return HttpResponse.json(withCount(job));
  })),
  http.put(`${B}/jobs/:id`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const job = db.jobs.find((j) => j.id === pid(c));
    if (!job) return err(404, "Job not found", "NOT_FOUND");
    Object.assign(job, await body<JobInput>(c));
    return HttpResponse.json(withCount(job));
  })),
  http.post(`${B}/jobs/:id/close`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const job = db.jobs.find((j) => j.id === pid(c));
    if (!job) return err(404, "Job not found", "NOT_FOUND");
    job.status = "closed";
    return HttpResponse.json(withCount(job));
  })),
  http.post(`${B}/jobs/:id/reopen`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const job = db.jobs.find((j) => j.id === pid(c));
    if (!job) return err(404, "Job not found", "NOT_FOUND");
    job.status = "open";
    return HttpResponse.json(withCount(job));
  })),
  http.post(`${B}/jobs/:id/apply`, h((c) => {
    const u = guard("candidate");
    if (isRes(u)) return u;
    const job = db.jobs.find((j) => j.id === pid(c));
    if (!job || job.status !== "open") return err(404, "Job not found or closed", "NOT_FOUND");
    const resume = db.resumes[u.id];
    if (!resume || resume.parse_status !== "parsed")
      return err(400, "Upload your resume before applying", "RESUME_REQUIRED");
    if (db.applications.some((a) => a.job_id === job.id && a.candidate_id === u.id))
      return err(409, "You already applied to this job", "ALREADY_APPLIED");
    const now = new Date().toISOString();
    const app: Application = {
      id: nextId(),
      job_id: job.id,
      candidate_id: u.id,
      candidate_name: u.full_name,
      status: "ai_assessment_available",
      assessment: buildAssessment(job, resume),
      submitted_at: now,
      updated_at: now,
    };
    db.applications.push(app);
    db.audit[app.id] = [
      { from_status: null, to_status: "submitted", changed_by: "System", created_at: now },
      { from_status: "submitted", to_status: "parsed", changed_by: "System", created_at: now },
      { from_status: "parsed", to_status: "ai_assessment_available", changed_by: "System", created_at: now },
    ];
    db.notes[app.id] = [];
    notify(`${u.full_name} applied to ${job.title}`);
    return HttpResponse.json(candidateSafe(app), { status: 201 });
  })),
  http.get(`${B}/jobs/:id/applications`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const url = new URL(c.request.url);
    const sort = url.searchParams.get("sort") ?? "score";
    const min = Number(url.searchParams.get("min_score") ?? 0);
    const skill = url.searchParams.get("skill")?.toLowerCase();
    const status = url.searchParams.get("status");
    let items = db.applications.filter((a) => a.job_id === pid(c));
    items = items.filter((a) => (a.assessment?.overridden ? a.assessment.override_score! : a.assessment?.overall_score ?? 0) >= min);
    if (skill)
      items = items.filter((a) =>
        a.assessment?.skill_results.some((r) => r.skill.toLowerCase() === skill && r.state !== "no_evidence_found"),
      );
    if (status) items = items.filter((a) => a.status === status);
    const score = (a: Application) => (a.assessment?.overridden ? a.assessment.override_score! : a.assessment?.overall_score ?? 0);
    items = [...items].sort((a, b) =>
      sort === "date" ? +new Date(b.submitted_at) - +new Date(a.submitted_at) : score(b) - score(a),
    );
    return HttpResponse.json(paginate(items, url));
  })),

  // ---------- CANDIDATE ----------
  http.get(`${B}/candidate/profile`, h(() => {
    const u = guard("candidate");
    if (isRes(u)) return u;
    return HttpResponse.json(
      db.profiles[u.id] ?? { headline: "", phone: "", location: "", interests: [], summary: "" },
    );
  })),
  http.put(`${B}/candidate/profile`, h(async (c) => {
    const u = guard("candidate");
    if (isRes(u)) return u;
    db.profiles[u.id] = await body(c);
    return HttpResponse.json(db.profiles[u.id]);
  })),
  http.post(`${B}/candidate/resume`, async (c) => {
    await delay(1400);
    const u = guard("candidate");
    if (isRes(u)) return u;
    const file = (await c.request.formData()).get("file");
    if (!(file instanceof File)) return err(400, "No file provided", "NO_FILE");
    const base = { id: nextId(), name: "", email: "", phone: "", links: [], skills: [], education: [], experience: [], projects: [], unsupported_claims: [] };
    let r: ParsedResume;
    if (!file.name.toLowerCase().endsWith(".pdf"))
      r = { ...base, parse_status: "unsupported", error_message: "Unsupported file type. Please upload a PDF." };
    else if (file.size === 0)
      r = { ...base, parse_status: "empty", error_message: "The file appears to be empty." };
    else if (file.name.toLowerCase().includes("fail"))
      r = { ...base, parse_status: "failed", error_message: "We could not read this PDF. Try exporting it again." };
    else r = SAMPLE_RESUME(u.full_name, u.email);
    db.resumes[u.id] = r;
    return HttpResponse.json(r, { status: 201 });
  }),
  http.get(`${B}/candidate/resume`, h(() => {
    const u = guard("candidate");
    if (isRes(u)) return u;
    const r = db.resumes[u.id];
    return r ? HttpResponse.json(r) : err(404, "No resume uploaded yet", "NOT_FOUND");
  })),
  http.put(`${B}/candidate/resume/parsed`, h(async (c) => {
    const u = guard("candidate");
    if (isRes(u)) return u;
    const existing = db.resumes[u.id];
    if (!existing) return err(404, "No resume uploaded yet", "NOT_FOUND");
    const b = await body<ResumeCorrections>(c);
    db.resumes[u.id] = { ...existing, ...b, skills: b.skills.map((s) => ({ ...s, edited_by: "candidate" })) };
    return HttpResponse.json(db.resumes[u.id]);
  })),
  http.get(`${B}/candidate/recommendations`, h(() => {
    const u = guard("candidate");
    if (isRes(u)) return u;
    const r = db.resumes[u.id];
    const out = db.jobs
      .filter((j) => j.status === "open")
      .map((job) => {
        const matched = job.required_skills
          .filter((s) => r?.skills.some((x) => x.normalized_name.toLowerCase() === s.name.toLowerCase()))
          .map((s) => s.name);
        const score = job.required_skills.length ? Math.round((matched.length / job.required_skills.length) * 100) : 0;
        return {
          job: withCount(job),
          match_score: score,
          matched_skills: matched,
          reason: matched.length
            ? `Your resume shows ${matched.join(", ")}, which this role asks for.`
            : "Upload or update your resume to see how you match.",
        };
      })
      .sort((a, b) => b.match_score - a.match_score);
    return HttpResponse.json(out);
  })),
  http.get(`${B}/candidate/applications`, h(() => {
    const u = guard("candidate");
    if (isRes(u)) return u;
    return HttpResponse.json(db.applications.filter((a) => a.candidate_id === u.id).map(candidateSafe));
  })),

  // ---------- RECRUITER: APPLICATIONS ----------
  http.post(`${B}/applications/compare`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const { application_ids } = await body<{ application_ids: number[] }>(c);
    if (application_ids.length < 2 || application_ids.length > 4)
      return err(422, "Select between 2 and 4 applications", "VALIDATION_ERROR");
    const out = application_ids.flatMap((id) => {
      const a = getApp(id);
      if (!a?.assessment) return [];
      return [{
        application_id: id,
        candidate_name: a.candidate_name,
        assessment: a.assessment,
        key_evidence: a.assessment.skill_results.filter((r) => r.state === "confirmed" && r.evidence_excerpt).map((r) => r.evidence_excerpt!),
        missing_info: a.assessment.skill_results.filter((r) => r.state === "no_evidence_found").map((r) => `No evidence found for ${r.skill}`),
      }];
    });
    return HttpResponse.json(out);
  })),
  http.get(`${B}/applications/:id`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const a = getApp(pid(c));
    if (!a || !a.assessment) return err(404, "Application not found", "NOT_FOUND");
    return HttpResponse.json({
      application: a,
      resume: db.resumes[a.candidate_id],
      assessment: a.assessment,
      notes: db.notes[a.id] ?? [],
      audit: db.audit[a.id] ?? [],
    });
  })),
  http.post(`${B}/applications/:id/status`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const a = getApp(pid(c));
    if (!a) return err(404, "Application not found", "NOT_FOUND");
    const b = await body<{ to_status: ApplicationStatus; reason?: string }>(c);
    if (b.to_status === "rejected" && !b.reason)
      return err(422, "A reason is required", "VALIDATION_ERROR", { fields: { reason: "Reason is required" } });
    touch(a, b.to_status, u.full_name, b.reason);
    return HttpResponse.json(a);
  })),
  http.get(`${B}/applications/:id/audit`, h((c) => {
    const u = guard("recruiter");
    return isRes(u) ? u : HttpResponse.json(db.audit[pid(c)] ?? []);
  })),
  http.get(`${B}/applications/:id/notes`, h((c) => {
    const u = guard("recruiter");
    return isRes(u) ? u : HttpResponse.json(db.notes[pid(c)] ?? []);
  })),
  http.post(`${B}/applications/:id/notes`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const { text } = await body<{ text: string }>(c);
    const note = { id: nextId(), text, author: u.full_name, created_at: new Date().toISOString() };
    (db.notes[pid(c)] ??= []).push(note);
    return HttpResponse.json(note, { status: 201 });
  })),
  http.put(`${B}/applications/:id/skills`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const a = getApp(pid(c));
    if (!a) return err(404, "Application not found", "NOT_FOUND");
    const { skills } = await body<{ skills: ResumeSkill[] }>(c);
    const r = db.resumes[a.candidate_id];
    r.skills = skills.map((s) => ({ ...s, edited_by: "recruiter" }));
    a.assessment = buildAssessment(db.jobs.find((j) => j.id === a.job_id)!, r, a.assessment);
    a.updated_at = new Date().toISOString();
    return HttpResponse.json(a);
  })),
  http.put(`${B}/applications/:id/override`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const a = getApp(pid(c));
    if (!a?.assessment) return err(404, "Application not found", "NOT_FOUND");
    const b = await body<{ score: number; reason: string }>(c);
    if (!b.reason?.trim())
      return err(422, "A reason is required", "VALIDATION_ERROR", { fields: { reason: "Reason is required" } });
    a.assessment = { ...a.assessment, overridden: true, override_score: b.score, override_reason: b.reason };
    (db.audit[a.id] ??= []).push({
      from_status: a.status,
      to_status: a.status,
      changed_by: u.full_name,
      reason: `Score override to ${b.score}: ${b.reason}`,
      created_at: new Date().toISOString(),
    });
    return HttpResponse.json(a);
  })),
  http.post(`${B}/applications/:id/reassess`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const a = getApp(pid(c));
    if (!a) return err(404, "Application not found", "NOT_FOUND");
    a.assessment = buildAssessment(db.jobs.find((j) => j.id === a.job_id)!, db.resumes[a.candidate_id], a.assessment);
    return HttpResponse.json(a);
  })),
  http.post(`${B}/applications/:id/decision`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const a = getApp(pid(c));
    if (!a) return err(404, "Application not found", "NOT_FOUND");
    const b = await body<{ decision: "selected" | "not_selected"; reason: string }>(c);
    touch(a, b.decision, u.full_name, b.reason);
    notify(`${a.candidate_name} marked as ${b.decision.replace("_", " ")}`);
    return HttpResponse.json(a);
  })),

  // ---------- QUESTIONS ----------
  http.post(`${B}/applications/:id/questions/generate`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const a = getApp(pid(c));
    if (!a?.assessment) return err(404, "Application not found", "NOT_FOUND");
    const b = await body<QuestionGenerateInput>(c);
    const skills = a.assessment.skill_results.map((r) => r.skill);
    const qs: InterviewQuestion[] = [];
    (Object.keys(b.counts) as Difficulty[]).forEach((d) => {
      for (let i = 0; i < b.counts[d]; i++) {
        const skill = skills[i % skills.length] ?? "your main stack";
        qs.push({
          id: nextId(),
          text: `(${d}) Explain how you have used ${skill} and a trade-off you made.`,
          difficulty: d,
          category: "role",
          answer_guideline: `Look for concrete examples of ${skill}, clear reasoning and awareness of trade-offs.`,
        });
      }
    });
    if (b.include_project_questions) {
      (db.resumes[a.candidate_id]?.projects ?? []).forEach((p) =>
        qs.push({
          id: nextId(),
          text: `Walk me through the "${p.name}" project. What was your role and what would you change?`,
          difficulty: "intermediate",
          category: "project",
          answer_guideline: "Candidate should describe their own contribution, key decisions and lessons learned.",
        }),
      );
    }
    db.questions[a.id] = qs;
    return HttpResponse.json(qs);
  })),
  http.get(`${B}/applications/:id/questions`, h((c) => {
    const u = guard("recruiter");
    return isRes(u) ? u : HttpResponse.json(db.questions[pid(c)] ?? []);
  })),
  http.put(`${B}/questions/:id`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const q = Object.values(db.questions).flat().find((x) => x.id === pid(c));
    if (!q) return err(404, "Question not found", "NOT_FOUND");
    Object.assign(q, await body<Pick<InterviewQuestion, "text" | "answer_guideline">>(c));
    return HttpResponse.json(q);
  })),
  http.delete(`${B}/questions/:id`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    for (const k of Object.keys(db.questions)) db.questions[Number(k)] = db.questions[Number(k)].filter((q) => q.id !== pid(c));
    return new HttpResponse(null, { status: 204 });
  })),
  http.post(`${B}/questions/:id/regenerate`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const q = Object.values(db.questions).flat().find((x) => x.id === pid(c));
    if (!q) return err(404, "Question not found", "NOT_FOUND");
    q.text = `${q.text.replace(/ \(variant \d+\)$/, "")} (variant ${Math.ceil(Math.random() * 9)})`;
    return HttpResponse.json(q);
  })),

  // ---------- INTERVIEWS ----------
  http.get(`${B}/interviewers`, h(() => {
    const u = guard("recruiter");
    return isRes(u) ? u : HttpResponse.json([{ id: 1, full_name: "Rana Recruiter" }, { id: 11, full_name: "Omar Tech Lead" }, { id: 12, full_name: "Hina HR" }]);
  })),
  http.post(`${B}/interviews`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const b = await body<InterviewInput>(c);
    const start = +new Date(b.scheduled_at);
    const end = start + b.duration_minutes * 60_000;
    const conflicts = db.interviews
      .filter((i) => i.interviewer_id === b.interviewer_id && i.status === "scheduled")
      .filter((i) => start < +new Date(i.scheduled_at) + i.duration_minutes * 60_000 && end > +new Date(i.scheduled_at))
      .map((i) => ({ interview_id: i.id, scheduled_at: i.scheduled_at, with: i.candidate_name }));
    if (conflicts.length && !b.force)
      return err(409, "The interviewer has a scheduling conflict", "SCHEDULING_CONFLICT", { conflicts });
    const a = getApp(b.application_id);
    if (!a) return err(404, "Application not found", "NOT_FOUND");
    const names: Record<number, string> = { 1: "Rana Recruiter", 11: "Omar Tech Lead", 12: "Hina HR" };
    const iv: Interview = {
      id: nextId(),
      application_id: a.id,
      candidate_name: a.candidate_name,
      job_title: db.jobs.find((j) => j.id === a.job_id)?.title ?? "",
      scheduled_at: b.scheduled_at,
      duration_minutes: b.duration_minutes,
      interviewer_id: b.interviewer_id,
      interviewer_name: names[b.interviewer_id] ?? "Interviewer",
      type: b.type,
      location_or_link: b.location_or_link,
      status: "scheduled",
    };
    db.interviews.push(iv);
    touch(a, "interview", u.full_name, "Interview scheduled");
    notify(`Interview scheduled with ${a.candidate_name}`);
    return HttpResponse.json(iv, { status: 201 });
  })),
  http.get(`${B}/interviews`, h(({ request }) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const iid = url.searchParams.get("interviewer_id");
    let items = [...db.interviews];
    if (from) items = items.filter((i) => +new Date(i.scheduled_at) >= +new Date(from));
    if (to) items = items.filter((i) => +new Date(i.scheduled_at) <= +new Date(to));
    if (iid) items = items.filter((i) => i.interviewer_id === Number(iid));
    return HttpResponse.json(items.sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at)));
  })),
  http.put(`${B}/interviews/:id`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const iv = db.interviews.find((i) => i.id === pid(c));
    if (!iv) return err(404, "Interview not found", "NOT_FOUND");
    Object.assign(iv, await body<Partial<InterviewInput>>(c));
    return HttpResponse.json(iv);
  })),
  http.post(`${B}/interviews/:id/feedback`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const iv = db.interviews.find((i) => i.id === pid(c));
    if (!iv) return err(404, "Interview not found", "NOT_FOUND");
    iv.feedback = await body<InterviewFeedback>(c);
    iv.status = "completed";
    return HttpResponse.json(iv);
  })),
  http.get(`${B}/notifications`, h(() => {
    const u = guard("recruiter");
    return isRes(u) ? u : HttpResponse.json(db.notifications);
  })),

  // ---------- ANALYTICS ----------
  http.get(`${B}/analytics/overview`, h(() => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const total = db.applications.length;
    const shortlisted = db.applications.filter((a) => ["shortlisted", "interview", "selected"].includes(a.status)).length;
    return HttpResponse.json({
      active_jobs: db.jobs.filter((j) => j.status === "open").length,
      total_applications: total,
      shortlisted,
      pending_reviews: db.applications.filter((a) => ["ai_assessment_available", "recruiter_review"].includes(a.status)).length,
      upcoming_interviews: db.interviews.filter((i) => i.status === "scheduled" && +new Date(i.scheduled_at) > Date.now()).length,
      shortlist_rate: total ? Math.round((shortlisted / total) * 100) : 0,
      avg_processing_days: 2.4,
    });
  })),
  http.get(`${B}/analytics/by-job`, h(() => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    return HttpResponse.json(
      db.jobs.map((j) => {
        const apps = db.applications.filter((a) => a.job_id === j.id);
        return {
          job_id: j.id,
          title: j.title,
          applications: apps.length,
          shortlisted: apps.filter((a) => ["shortlisted", "interview", "selected"].includes(a.status)).length,
        };
      }),
    );
  })),
  http.get(`${B}/analytics/funnel`, h(() => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const n = (s: ApplicationStatus[]) => db.applications.filter((a) => s.includes(a.status)).length;
    const all = db.applications.length;
    const reviewed = all - n(["submitted", "parsed"]);
    const short = n(["shortlisted", "interview", "selected", "not_selected"]);
    const iv = n(["interview", "selected", "not_selected"]);
    return HttpResponse.json([
      { stage: "Applied", count: all },
      { stage: "Assessed", count: reviewed },
      { stage: "Shortlisted", count: short },
      { stage: "Interview", count: iv },
      { stage: "Selected", count: n(["selected"]) },
    ]);
  })),
  http.get(`${B}/analytics/skill-gaps`, h(() => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const total = db.applications.length || 1;
    const counts: Record<string, number> = {};
    db.applications.forEach((a) =>
      a.assessment?.skill_results.filter((r) => r.state === "no_evidence_found").forEach((r) => (counts[r.skill] = (counts[r.skill] ?? 0) + 1)),
    );
    return HttpResponse.json(
      Object.entries(counts)
        .map(([skill, missing_count]) => ({ skill, missing_count, percentage: Math.round((missing_count / total) * 100) }))
        .sort((a, b) => b.missing_count - a.missing_count),
    );
  })),

  // ---------- TALENT ----------
  http.post(`${B}/talent/search`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const { query, limit } = await body<{ query: string; job_id?: number; limit: number }>(c);
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !["with", "and", "developers", "experience"].includes(t));
    const results = Object.entries(db.resumes)
      .map(([cid, r]) => {
        const excerpts = [...r.skills.map((s) => s.evidence_excerpt), ...r.projects.map((p) => p.evidence_excerpt), ...r.experience.map((e) => e.evidence_excerpt)];
        const matched_terms = terms.filter((t) => excerpts.some((e) => e.toLowerCase().includes(t)));
        return {
          candidate_id: Number(cid),
          name: r.name,
          score: terms.length ? Math.round((matched_terms.length / terms.length) * 100) : 0,
          evidence_excerpts: excerpts.filter((e) => matched_terms.some((t) => e.toLowerCase().includes(t))).slice(0, 3),
          matched_terms,
        };
      })
      .filter((r) => r.matched_terms.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return HttpResponse.json(results);
  })),
  http.get(`${B}/talent/pool`, h(({ request }) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const jobId = Number(new URL(request.url).searchParams.get("job_id"));
    const out = db.applications
      .filter((a) => a.job_id !== jobId)
      .concat(db.applications.filter((a) => a.job_id === jobId && ["rejected", "not_selected"].includes(a.status)))
      .map((a) => ({
        candidate_id: a.candidate_id,
        name: a.candidate_name,
        last_job_title: db.jobs.find((j) => j.id === a.job_id)?.title ?? "",
        last_score: a.assessment?.overall_score ?? 0,
        reviewed_at: a.updated_at,
        retention_expires_at: daysAgo(-180),
        contact_permission: a.candidate_id % 2 === 0,
      }));
    return HttpResponse.json(out);
  })),
  http.get(`${B}/talent/duplicates`, h(() => {
    const u = guard("recruiter");
    return isRes(u) ? u : HttpResponse.json(db.duplicates);
  })),
  http.post(`${B}/talent/duplicates/:id/merge`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    db.duplicates = db.duplicates.filter((d) => d.id !== pid(c));
    return new HttpResponse(null, { status: 204 });
  })),
  http.post(`${B}/talent/duplicates/:id/dismiss`, h((c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    db.duplicates = db.duplicates.filter((d) => d.id !== pid(c));
    return new HttpResponse(null, { status: 204 });
  })),
  http.post(`${B}/fairness/test`, h(async (c) => {
    const u = guard("recruiter");
    if (isRes(u)) return u;
    const b = await body<{ application_id: number; attributes: FairnessAttribute[] }>(c);
    const a = getApp(b.application_id);
    if (!a?.assessment) return err(404, "Application not found", "NOT_FOUND");
    const changed: Record<FairnessAttribute, string> = { name: "A different name", gender: "A different gender", age: "Age + 10 years", location: "A different city" };
    const original = a.assessment.overall_score;
    const variants = b.attributes.map((attribute) => ({ attribute, changed_to: changed[attribute], score: original, delta: 0 }));
    return HttpResponse.json({ original_score: original, variants, passed: true });
  })),
];