import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    studentId: z.string().min(2, "Student ID is required"),
    department: z.string().min(1, "Please select a department"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Email form schema
// ---------------------------------------------------------------------------

export const emailFormSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  studentId: z.string().min(2, "Student ID is required"),
  department: z.string().min(2, "Department is required"),
  level: z.string().min(1, "Level is required"),
  reason: z.string().min(5, "Reason must contain at least 5 characters"),
  recipientOffice: z.string().min(2, "Recipient office is required"),
});