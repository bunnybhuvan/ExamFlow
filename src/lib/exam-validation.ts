import { z } from "zod";

const list = z.string().transform((s) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
);
export const examSchema = z
  .object({
    course_code: z
      .string()
      .trim()
      .min(2, "Required")
      .max(16)
      .regex(/^[A-Z]{2,5}\d{2,4}[A-Z]?$/i, "Format like CS101"),
    course_name: z.string().trim().min(3, "At least 3 characters").max(120),
    department: z.string().trim().min(2, "Required").max(80),
    duration_minutes: z.coerce.number().int().min(30, "Min 30 minutes").max(480, "Max 8 hours"),
    enrollment: z.coerce.number().int().min(1, "At least 1").max(5000),
    window_start: z.string().min(1, "Required"),
    window_end: z.string().min(1, "Required"),
    required_equipment: list,
    accommodations: list,
    status: z.enum(["draft", "pending", "scheduled", "unassigned", "conflict"]),
  })
  .refine((v) => v.window_end >= v.window_start, {
    path: ["window_end"],
    message: "End must be on/after start",
  });
