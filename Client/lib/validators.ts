import { z } from "zod";

const email = z.string().trim().min(1, "Email is required").email("Enter a valid email address");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100, "Name is too long"),
  email,
  password: z.string().min(8, "Use at least 8 characters").max(128, "Password is too long"),
  role: z.enum(["candidate", "recruiter"], {
    errorMap: () => ({ message: "Choose how you will use Talentra" }),
  }),
});

const phoneField = z
  .string()
  .trim()
  .refine((value) => value === "" || /^[+\d\s().-]{7,20}$/.test(value), "Enter a valid phone number");

export const profileSchema = z.object({
  headline: z.string().trim().max(120, "Keep your headline under 120 characters"),
  phone: phoneField,
  location: z.string().trim().max(80, "Keep your location under 80 characters"),
  interests: z.array(z.string().trim().min(1)).max(15, "Add up to 15 interests"),
  summary: z.string().trim().max(1000, "Keep your summary under 1000 characters"),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const resumeCorrectionSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: phoneField,
  links: z.array(z.string().trim().min(1)),
  skills: z.array(
    z.object({
      name: z.string().trim().min(1),
      normalized_name: z.string().trim().min(1),
      evidence_excerpt: z.string(),
      verified: z.boolean(),
      edited_by: z.enum(["ai", "candidate", "recruiter"]),
    }),
  ),
  education: z.array(
    z.object({
      degree: z.string().trim().min(1, "Degree is required"),
      institution: z.string().trim().min(1, "Institution is required"),
      year: z.string().trim().max(20, "Keep this under 20 characters"),
      evidence_excerpt: z.string(),
    }),
  ),
  experience: z.array(
    z.object({
      title: z.string().trim().min(1, "Job title is required"),
      company: z.string().trim().min(1, "Company is required"),
      start: z.string().trim().max(30),
      end: z.string().trim().max(30),
      years: z.number({ invalid_type_error: "Enter a number" }).min(0, "Cannot be negative").max(60, "Enter 60 or less"),
      summary: z.string().trim().max(2000, "Keep this under 2000 characters"),
      evidence_excerpt: z.string(),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string().trim().min(1, "Project name is required"),
      description: z.string().trim().max(2000, "Keep this under 2000 characters"),
      technologies: z.array(z.string().trim().min(1)),
      evidence_excerpt: z.string(),
    }),
  ),
});


const moneyField = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter a valid amount");

const skillReqSchema = z.object({
  name: z.string().trim().min(1, "Skill name is required").max(60, "Keep skill names under 60 characters"),
  importance: z.number().int().min(1).max(5),
});

export const jobSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a job title").max(120, "Keep the title under 120 characters"),
    department: z.string().trim().min(1, "Department is required").max(80, "Keep this under 80 characters"),
    location: z.string().trim().min(1, "Location is required").max(80, "Keep this under 80 characters"),
    type: z.enum(["full_time", "part_time", "contract", "internship"]),
    salary_min: moneyField,
    salary_max: moneyField,
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a 3-letter code, e.g. USD"),
    min_experience_years: z
      .string()
      .trim()
      .refine((v) => /^\d{1,2}$/.test(v) && Number(v) <= 50, "Enter a whole number from 0 to 50"),
    description: z
      .string()
      .trim()
      .min(30, "Describe the role in at least 30 characters")
      .max(8000, "Keep the description under 8000 characters"),
    required_skills: z.array(skillReqSchema).min(1, "Add at least one required skill").max(20, "Add up to 20 skills"),
    preferred_skills: z.array(skillReqSchema).max(20, "Add up to 20 skills"),
    qualifications: z.string().max(2000, "Keep this under 2000 characters"),
  })
  .refine((v) => v.salary_min === "" || v.salary_max === "" || Number(v.salary_max) >= Number(v.salary_min), {
    message: "Maximum must be at least the minimum",
    path: ["salary_max"],
  });
export type JobValues = z.infer<typeof jobSchema>;

export const MANUAL_STATUSES = ["recruiter_review", "shortlisted", "rejected"] as const;

export const statusChangeSchema = z
  .object({
    to_status: z.enum(MANUAL_STATUSES),
    reason: z.string().trim().max(500, "Keep this under 500 characters"),
  })
  .refine((v) => v.to_status !== "rejected" || v.reason.length >= 5, {
    message: "Give a short reason for rejecting",
    path: ["reason"],
  });
export type StatusChangeValues = z.infer<typeof statusChangeSchema>;

export const overrideSchema = z.object({
  score: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}$/.test(v) && Number(v) <= 100, "Enter a whole number from 0 to 100"),
  reason: z.string().trim().min(10, "Explain the override in at least 10 characters").max(500, "Keep this under 500 characters"),
});
export type OverrideValues = z.infer<typeof overrideSchema>;

export const noteSchema = z.object({
  text: z.string().trim().min(1, "Write a note first").max(2000, "Keep notes under 2000 characters"),
});

const rating = z.string().regex(/^[1-5]$/, "Choose 1 to 5");
const count = z
  .string()
  .trim()
  .refine((v) => /^\d{1,2}$/.test(v) && Number(v) <= 10, "0 to 10");

export const scheduleSchema = z
  .object({
    date: z.string().min(1, "Pick a date"),
    time: z.string().min(1, "Pick a time"),
    duration_minutes: z
      .string()
      .trim()
      .refine((v) => /^\d{2,3}$/.test(v) && Number(v) >= 15 && Number(v) <= 480, "Enter 15 to 480 minutes"),
    interviewer_id: z.string().min(1, "Choose an interviewer"),
    type: z.enum(["technical", "hr", "managerial", "panel"]),
    location_or_link: z.string().trim().min(3, "Add a location or meeting link").max(300, "Keep this under 300 characters"),
  })
  .refine((v) => !v.date || !v.time || new Date(`${v.date}T${v.time}`).getTime() > Date.now(), {
    message: "Choose a time in the future",
    path: ["time"],
  });
export type ScheduleValues = z.infer<typeof scheduleSchema>;

export const feedbackSchema = z.object({
  ratings: z.object({ technical: rating, communication: rating, problem_solving: rating, culture: rating }),
  strengths: z.string().trim().min(5, "Describe at least one strength").max(1000, "Keep this under 1000 characters"),
  concerns: z.string().trim().max(1000, "Keep this under 1000 characters"),
  recommendation: z.enum(["strong_yes", "yes", "no", "strong_no"]),
});
export type FeedbackValues = z.infer<typeof feedbackSchema>;

export const decisionSchema = z.object({
  decision: z.enum(["selected", "not_selected"]),
  reason: z.string().trim().min(5, "Give a short reason").max(500, "Keep this under 500 characters"),
});
export type DecisionValues = z.infer<typeof decisionSchema>;

export const questionGenSchema = z
  .object({
    counts: z.object({ beginner: count, intermediate: count, advanced: count }),
    include_project_questions: z.boolean(),
  })
  .refine((v) => Number(v.counts.beginner) + Number(v.counts.intermediate) + Number(v.counts.advanced) > 0, {
    message: "Ask for at least one question",
    path: ["counts", "beginner"],
  });
  
export type QuestionGenValues = z.infer<typeof questionGenSchema>;

export type NoteValues = z.infer<typeof noteSchema>;

export type ResumeCorrectionValues = z.infer<typeof resumeCorrectionSchema>;

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;