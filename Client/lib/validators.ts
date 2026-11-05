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

export type ResumeCorrectionValues = z.infer<typeof resumeCorrectionSchema>;

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;