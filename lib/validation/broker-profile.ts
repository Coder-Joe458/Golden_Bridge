import { z } from "zod";

export const brokerProfileSchema = z.object({
  company: z
    .string()
    .trim()
    .max(120, "Company name is too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length ? val : null)),
  headline: z
    .string()
    .trim()
    .max(160, "Headline is too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length ? val : null)),
  bio: z
    .string()
    .trim()
    .max(2000, "Bio must be under 2000 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length ? val : null)),
  licenseStates: z
    .array(z.string().trim().regex(/^[A-Za-z]{2}$/u, "Use two-letter state codes"))
    .optional()
    .nullable()
    .transform((val) => (val ? val.map((state) => state.toUpperCase()) : [])),
  yearsExperience: z
    .number({ invalid_type_error: "Years of experience must be a number" })
    .int("Years of experience must be an integer")
    .min(0, "Experience cannot be negative")
    .max(80, "Experience seems too high")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  website: z
    .string()
    .trim()
    .url("Please provide a valid URL")
    .optional()
    .or(z.literal(""))
    .nullable()
    .transform((val) => (val && val.length ? val : null)),
  minRate: z
    .number({ invalid_type_error: "Minimum rate must be a number" })
    .min(0, "Minimum rate must be at least 0")
    .max(99, "Minimum rate is too high")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  maxRate: z
    .number({ invalid_type_error: "Maximum rate must be a number" })
    .min(0, "Maximum rate must be at least 0")
    .max(99, "Maximum rate is too high")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  loanPrograms: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Loan programme cannot be empty")
        .max(120, "Loan programme description is too long")
    )
    .optional()
    .nullable()
    .transform((val) => (val ? val : [])),
  minCreditScore: z
    .number({ invalid_type_error: "Minimum credit score must be a number" })
    .int("Minimum credit score must be an integer")
    .min(300, "Minimum credit score cannot be below 300")
    .max(850, "Minimum credit score cannot exceed 850")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  maxLoanToValue: z
    .number({ invalid_type_error: "Maximum LTV must be a number" })
    .int("Maximum LTV must be an integer")
    .min(10, "Maximum LTV should be at least 10")
    .max(100, "Maximum LTV cannot exceed 100")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be under 2000 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length ? val : null)),
  closingSpeedDays: z
    .number({ invalid_type_error: "Closing speed must be a number" })
    .int("Closing speed must be an integer")
    .min(1, "Closing speed must be at least 1 day")
    .max(120, "Closing speed should be within 120 days")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null))
});

const normalizeArray = (values: string[] | null | undefined) => (values ? values : []);

export const adminCreateBrokerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Provide a valid email"),
  phoneNumber: z
    .string()
    .trim()
    .min(7, "Phone number is too short")
    .max(24, "Phone number is too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length ? val : null)),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  profile: brokerProfileSchema
    .extend({
      licenseStates: brokerProfileSchema.shape.licenseStates.transform(normalizeArray),
      loanPrograms: brokerProfileSchema.shape.loanPrograms.transform(normalizeArray)
    })
    .optional()
    .nullable()
});

export type BrokerProfileInput = z.infer<typeof brokerProfileSchema>;
export type AdminCreateBrokerInput = z.infer<typeof adminCreateBrokerSchema>;
