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

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;