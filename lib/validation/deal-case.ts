import { z } from "zod";

export const localizedTextSchema = z.object({
  en: z
    .string()
    .trim()
    .min(1, "English copy is required")
    .max(300, "English copy is too long"),
  zh: z
    .string()
    .trim()
    .min(1, "Chinese copy is required")
    .max(300, "Chinese copy is too long")
});

export const dealCaseImageSchema = z.object({
  url: z
    .string()
    .trim()
    .url("Image URL must be a valid URL")
    .max(2000, "Image URL is too long"),
  alt: localizedTextSchema,
  sortOrder: z
    .number({ invalid_type_error: "Sort order must be a number" })
    .int("Sort order must be an integer")
    .min(0, "Sort order must be at least 0")
    .max(10_000, "Sort order is too large")
    .optional()
});

export const dealCaseSchema = z.object({
  caseCode: z
    .string()
    .trim()
    .min(2, "Case code is required")
    .max(40, "Case code is too long")
    .transform((value) => value.toUpperCase()),
  city: z
    .string()
    .trim()
    .min(2, "City is required")
    .max(120, "City is too long"),
  state: z
    .string()
    .trim()
    .min(2, "State is required")
    .max(120, "State is too long"),
  heroImageUrl: z
    .string()
    .trim()
    .url("Hero image must be a valid URL")
    .max(2000, "Hero image URL is too long"),
  price: localizedTextSchema,
  timeline: localizedTextSchema,
  borrowerType: localizedTextSchema,
  product: localizedTextSchema,
  highlight: localizedTextSchema,
  published: z.boolean().default(true),
  gallery: z
    .array(dealCaseImageSchema)
    .max(12, "Gallery can have at most 12 images")
});

export type DealCaseInput = z.infer<typeof dealCaseSchema>;
export type DealCaseImageInput = z.infer<typeof dealCaseImageSchema>;
