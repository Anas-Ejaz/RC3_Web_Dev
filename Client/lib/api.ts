import type {
  AnalyticsOverview,
  Application,
  ApplicationDetail,
  ApplicationStatus,
  ApiErrorBody,
  AppNotification,
  AuditEntry,
  ByJobStat,
  CandidateProfile,
  ComparisonItem,
  DuplicatePair,
  ExtractedRequirements,
  FairnessAttribute,
  FairnessResult,
  FunnelStage,
  Interview,
  InterviewFeedback,
  InterviewInput,
  InterviewQuestion,
  Interviewer,
  Job,
  JobInput,
  Note,
  Page,
  ParsedResume,
  QuestionGenerateInput,
  RecommendedJob,
  ResumeCorrections,
  ResumeSkill,
  Role,
  SchedulingConflict,
  SkillGap,
  TalentPoolEntry,
  TalentSearchResult,
  User,
} from "@/types/api";

const BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  data: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
    this.data = body;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function getSchedulingConflicts(e: unknown): SchedulingConflict[] | null {
  if (isApiError(e) && e.status === 409 && e.code === "SCHEDULING_CONFLICT") {
    return (e.data.conflicts as SchedulingConflict[]) ?? [];
  }
  return null;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(query?: Query) {
  if (!query) return "";
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs(opts.query)}`, {
      method: opts.method ?? "GET",
      credentials: "include",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, { detail: "Network error. Check your connection and try again.", code: "NETWORK_ERROR" });
  }

  if (!res.ok) {
    let body: ApiErrorBody;
    try {
      body = await res.json();
    } catch {
      body = { detail: res.statusText || "Something went wrong", code: "UNKNOWN" };
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const get = <T>(path: string, query?: Query) => request<T>(path, { query });
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ?? {} });
const put = <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

/** Resume upload via XHR so we can report real upload progress. */
export function uploadResume(file: File, onProgress?: (percent: number) => void): Promise<ParsedResume> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/candidate/resume`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => onProgress?.(100);
    xhr.onerror = () =>
      reject(new ApiError(0, { detail: "Upload failed. Check your connection and try again.", code: "NETWORK_ERROR" }));
    xhr.onload = () => {
      let data: unknown;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as ParsedResume);
      else
        reject(
          new ApiError(
            xhr.status,
            (data as ApiErrorBody) ?? { detail: "Upload failed", code: "UNKNOWN" },
          ),
        );
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export interface JobListParams {
  status?: string;
  q?: string;
  location?: string;
  type?: string;
  page?: number;
  page_size?: number;
}

export interface ApplicantListParams {
  sort?: "score" | "date";
  min_score?: number;
  skill?: string;
  status?: ApplicationStatus | "";
  page?: number;
  page_size?: number;
}

export const api = {
  auth: {
    register: (b: { email: string; password: string; full_name: string; role: Role }) =>
      post<User>("/auth/register", b),
    login: (b: { email: string; password: string }) => post<User>("/auth/login", b),
    logout: () => post<void>("/auth/logout"),
    me: () => get<User>("/auth/me"),
  },
  jobs: {
    list: (p?: JobListParams) => get<Page<Job>>("/jobs", p as Query),
    get: (id: number) => get<Job>(`/jobs/${id}`),
    create: (b: JobInput) => post<Job>("/jobs", b),
    update: (id: number, b: JobInput) => put<Job>(`/jobs/${id}`, b),
    close: (id: number) => post<Job>(`/jobs/${id}/close`),
    reopen: (id: number) => post<Job>(`/jobs/${id}/reopen`),
    extractRequirements: (description: string) =>
      post<ExtractedRequirements>("/jobs/extract-requirements", { description }),
    apply: (id: number) => post<Application>(`/jobs/${id}/apply`),
    applications: (id: number, p?: ApplicantListParams) =>
      get<Page<Application>>(`/jobs/${id}/applications`, p as Query),
  },
  candidate: {
    getProfile: () => get<CandidateProfile>("/candidate/profile"),
    updateProfile: (b: CandidateProfile) => put<CandidateProfile>("/candidate/profile", b),
    getResume: () => get<ParsedResume>("/candidate/resume"),
    saveResumeCorrections: (b: ResumeCorrections) => put<ParsedResume>("/candidate/resume/parsed", b),
    recommendations: () => get<RecommendedJob[]>("/candidate/recommendations"),
    applications: () => get<Application[]>("/candidate/applications"),
  },
  applications: {
    get: (id: number) => get<ApplicationDetail>(`/applications/${id}`),
    setStatus: (id: number, b: { to_status: ApplicationStatus; reason?: string }) =>
      post<Application>(`/applications/${id}/status`, b),
    audit: (id: number) => get<AuditEntry[]>(`/applications/${id}/audit`),
    notes: (id: number) => get<Note[]>(`/applications/${id}/notes`),
    addNote: (id: number, text: string) => post<Note>(`/applications/${id}/notes`, { text }),
    updateSkills: (id: number, skills: ResumeSkill[]) => put<Application>(`/applications/${id}/skills`, { skills }),
    override: (id: number, b: { score: number; reason: string }) => put<Application>(`/applications/${id}/override`, b),
    reassess: (id: number) => post<Application>(`/applications/${id}/reassess`),
    compare: (application_ids: number[]) => post<ComparisonItem[]>("/applications/compare", { application_ids }),
    decide: (id: number, b: { decision: "selected" | "not_selected"; reason: string }) =>
      post<Application>(`/applications/${id}/decision`, b),
  },
  questions: {
    generate: (appId: number, b: QuestionGenerateInput) =>
      post<InterviewQuestion[]>(`/applications/${appId}/questions/generate`, b),
    list: (appId: number) => get<InterviewQuestion[]>(`/applications/${appId}/questions`),
    update: (qid: number, b: Pick<InterviewQuestion, "text" | "answer_guideline">) =>
      put<InterviewQuestion>(`/questions/${qid}`, b),
    remove: (qid: number) => del<void>(`/questions/${qid}`),
    regenerate: (qid: number) => post<InterviewQuestion>(`/questions/${qid}/regenerate`),
  },
  interviews: {
    interviewers: () => get<Interviewer[]>("/interviewers"),
    create: (b: InterviewInput) => post<Interview>("/interviews", b),
    list: (p?: { from?: string; to?: string; interviewer_id?: number }) => get<Interview[]>("/interviews", p as Query),
    update: (id: number, b: Partial<InterviewInput>) => put<Interview>(`/interviews/${id}`, b),
    feedback: (id: number, b: InterviewFeedback) => post<Interview>(`/interviews/${id}/feedback`, b),
    notifications: () => get<AppNotification[]>("/notifications"),
  },
  analytics: {
    overview: () => get<AnalyticsOverview>("/analytics/overview"),
    byJob: () => get<ByJobStat[]>("/analytics/by-job"),
    funnel: () => get<FunnelStage[]>("/analytics/funnel"),
    skillGaps: () => get<SkillGap[]>("/analytics/skill-gaps"),
  },
  talent: {
    search: (b: { query: string; job_id?: number; limit: number }) => post<TalentSearchResult[]>("/talent/search", b),
    pool: (job_id: number) => get<TalentPoolEntry[]>("/talent/pool", { job_id }),
    duplicates: () => get<DuplicatePair[]>("/talent/duplicates"),
    merge: (id: number) => post<void>(`/talent/duplicates/${id}/merge`),
    dismiss: (id: number) => post<void>(`/talent/duplicates/${id}/dismiss`),
    fairness: (b: { application_id: number; attributes: FairnessAttribute[] }) =>
      post<FairnessResult>("/fairness/test", b),
  },
};