import type {
  Application,
  AppNotification,
  AuditEntry,
  CandidateProfile,
  DuplicatePair,
  Interview,
  InterviewQuestion,
  Job,
  Note,
  ParsedResume,
  User,
} from "@/types/api";

export type MockUser = User & { password: string };

let seq = 1000;
export const nextId = () => ++seq;

export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const sk = (name: string, verified: boolean, excerpt: string): ParsedResume["skills"][number] => ({
  name,
  normalized_name: name,
  evidence_excerpt: excerpt,
  verified,
  edited_by: "ai",
});

function resume(
  id: number,
  name: string,
  email: string,
  skills: ParsedResume["skills"],
  years: number,
  projects: ParsedResume["projects"],
  claims: ParsedResume["unsupported_claims"] = [],
): ParsedResume {
  return {
    id,
    parse_status: "parsed",
    name,
    email,
    phone: "+92 300 0000000",
    links: ["https://github.com/example"],
    skills,
    education: [
      {
        degree: "BS Computer Science",
        institution: "FAST-NUCES",
        year: "2021",
        evidence_excerpt: "BS Computer Science, FAST-NUCES, 2017–2021",
      },
    ],
    experience: [
      {
        title: "Software Engineer",
        company: "Northwind Labs",
        start: "2021-06",
        end: "present",
        years,
        summary: "Built and maintained backend services and internal tooling.",
        evidence_excerpt: "Software Engineer at Northwind Labs (Jun 2021 – present): built backend services.",
      },
    ],
    projects,
    unsupported_claims: claims,
  };
}

export const SAMPLE_RESUME = (name: string, email: string): ParsedResume =>
  resume(
    nextId(),
    name,
    email,
    [
      sk("Python", true, "Developed REST services in Python for 3 years."),
      sk("SQL", false, "Familiar with SQL databases."),
      sk("Git", true, "Daily Git workflow with pull requests and code review."),
    ],
    3,
    [
      {
        name: "Inventory API",
        description: "REST API for stock tracking.",
        technologies: ["Python", "SQL"],
        evidence_excerpt: "Inventory API: REST API for stock tracking using Python and SQL.",
      },
    ],
  );

export const db = {
  users: [
    { id: 1, email: "recruiter@demo.com", password: "password", full_name: "Rana Recruiter", role: "recruiter" },
    { id: 2, email: "aisha@demo.com", password: "password", full_name: "Aisha Khan", role: "candidate" },
    { id: 3, email: "bilal@demo.com", password: "password", full_name: "Bilal Ahmed", role: "candidate" },
    { id: 4, email: "sara@demo.com", password: "password", full_name: "Sara Malik", role: "candidate" },
  ] as MockUser[],

  jobs: [
    {
      id: 1,
      title: "Backend Developer",
      department: "Engineering",
      location: "Lahore",
      type: "full_time",
      salary_min: 250000,
      salary_max: 400000,
      currency: "PKR",
      description:
        "Build and scale backend services with Python and Django. You will design APIs, work with PostgreSQL, and ship with Docker. 2+ years of experience required. Experience with Redis is a plus.",
      required_skills: [
        { name: "Python", importance: 5 },
        { name: "Django", importance: 5 },
        { name: "PostgreSQL", importance: 4 },
        { name: "Docker", importance: 4 },
      ],
      preferred_skills: [{ name: "Redis", importance: 2 }],
      min_experience_years: 2,
      qualifications: ["BS in Computer Science or equivalent"],
      status: "open",
      applicant_count: 0,
      created_at: daysAgo(6),
    },
    {
      id: 2,
      title: "Frontend Engineer",
      department: "Engineering",
      location: "Remote",
      type: "contract",
      salary_min: 180000,
      salary_max: 300000,
      currency: "PKR",
      description: "Build accessible React interfaces with TypeScript.",
      required_skills: [
        { name: "React", importance: 5 },
        { name: "TypeScript", importance: 4 },
      ],
      preferred_skills: [{ name: "Tailwind CSS", importance: 3 }],
      min_experience_years: 2,
      qualifications: [],
      status: "open",
      applicant_count: 0,
      created_at: daysAgo(3),
    },
    {
      id: 3,
      title: "Data Analyst",
      department: "Data",
      location: "Karachi",
      type: "part_time",
      salary_min: 120000,
      salary_max: 200000,
      currency: "PKR",
      description: "Turn data into decisions using SQL and dashboards.",
      required_skills: [
        { name: "SQL", importance: 5 },
        { name: "Python", importance: 3 },
      ],
      preferred_skills: [],
      min_experience_years: 1,
      qualifications: [],
      status: "closed",
      applicant_count: 0,
      created_at: daysAgo(20),
    },
  ] as Job[],

  profiles: {} as Record<number, CandidateProfile>,

  resumes: {
    2: resume(
      501,
      "Aisha Khan",
      "aisha@demo.com",
      [
        sk("Python", true, "5 years building Python services; led migration of a Flask monolith."),
        sk("Django", true, "Built a multi-tenant Django REST API serving 200k users."),
        sk("PostgreSQL", true, "Tuned PostgreSQL queries and indexes, cutting p95 latency by 40%."),
        sk("Docker", true, "Containerised services with Docker and Docker Compose for CI."),
      ],
      4,
      [
        {
          name: "Billing Service",
          description: "Django + PostgreSQL billing microservice.",
          technologies: ["Python", "Django", "PostgreSQL", "Docker"],
          evidence_excerpt: "Billing Service: Django and PostgreSQL billing microservice deployed with Docker.",
        },
        {
          name: "Job Queue",
          description: "Background workers with Celery.",
          technologies: ["Python", "Celery"],
          evidence_excerpt: "Job Queue: Celery workers processing 50k tasks per day.",
        },
      ],
    ),
    3: resume(
      502,
      "Bilal Ahmed",
      "bilal@demo.com",
      [
        sk("Python", true, "2 years of Python scripting and Django views."),
        sk("Django", true, "Built admin dashboards using Django."),
        sk("PostgreSQL", false, "Worked with PostgreSQL."),
      ],
      2,
      [
        {
          name: "Blog Platform",
          description: "Django blog with auth.",
          technologies: ["Python", "Django"],
          evidence_excerpt: "Blog Platform: Django blog with user authentication.",
        },
      ],
    ),
    4: resume(
      503,
      "Sara Malik",
      "sara@demo.com",
      [
        sk("Python", true, "Used Python for data cleaning scripts."),
        sk("JavaScript", true, "Built interactive pages with JavaScript and React."),
        sk("Docker", false, "Expert in Docker, Kubernetes and cloud architecture."),
      ],
      1,
      [],
      [
        {
          claim: "Expert in Docker, Kubernetes and cloud architecture",
          reason: "No project or role in the resume demonstrates this; flagged for manual review.",
        },
      ],
    ),
  } as Record<number, ParsedResume>,

  applications: [] as Application[],
  notes: {} as Record<number, Note[]>,
  audit: {} as Record<number, AuditEntry[]>,
  questions: {} as Record<number, InterviewQuestion[]>,
  interviews: [] as Interview[],
  notifications: [
    { id: 1, message: "Welcome! Simulated notifications will appear here.", created_at: daysAgo(1), read: false },
  ] as AppNotification[],
  duplicates: [
    {
      id: 1,
      candidate_a: {
        id: 2,
        name: "Aisha Khan",
        email: "aisha@demo.com",
        phone: "+92 300 0000000",
        skills: ["Python", "Django", "PostgreSQL", "Docker"],
      },
      candidate_b: {
        id: 90,
        name: "Aisha K.",
        email: "aisha.khan@mail.com",
        phone: "+92 300 0000000",
        skills: ["Python", "Django", "PostgreSQL"],
      },
      similarity: 0.93,
      reasons: ["Same phone number", "Near-identical name", "4 of 4 skills overlap"],
    },
  ] as DuplicatePair[],
};

export const SESSION_KEY = "mock_user_id";