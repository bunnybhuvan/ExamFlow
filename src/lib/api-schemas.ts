import { z } from "zod";

const text = z.string();
const count = z.number().int().nonnegative();
const strings = z.array(text);
const date = text.refine((s) => Number.isFinite(Date.parse(s)), "Invalid date");
const ratio = z.number().min(0).max(1);
export const examResponse = z.object({
  id: text,
  course_code: text,
  course_name: text,
  department: text,
  duration_minutes: count,
  enrollment: count,
  window_start: date,
  window_end: date,
  required_equipment: strings,
  accommodations: strings,
  status: z.enum(["draft", "pending", "scheduled", "unassigned", "conflict"]),
});
export const studentResponse = z.object({
  id: text,
  name: text,
  email: text,
  program: text,
  year: count,
  enrollments: strings,
  accommodations: strings,
});
export const roomResponse = z.object({
  id: text,
  name: text,
  building: text,
  capacity: count,
  equipment: strings,
  accessible: z.boolean(),
  closures: z.array(z.object({ start: date, end: date, reason: text })),
  utilization: ratio,
});
export const invigilatorResponse = z.object({
  id: text,
  name: text,
  email: text,
  department: text,
  qualifications: strings,
  available_days: z.array(date),
  max_duties: count,
  assigned_duties: count,
  conflicts: count,
});
export const assignmentResponse = z.object({
  id: text,
  exam_id: text,
  course_code: text,
  course_name: text,
  room_id: text,
  room_name: text,
  invigilator_ids: strings,
  start: date,
  end: date,
  enrolled: count,
  capacity: z.number().positive(),
  status: z.enum(["confirmed", "tentative", "conflict"]),
});
export const unassignedResponse = z.object({
  exam_id: text,
  course_code: text,
  course_name: text,
  reason_code: text,
  reason: text,
});
export const auditResponse = z.object({
  id: text,
  timestamp: date,
  actor: text,
  action: text,
  entity_type: text,
  entity_id: text,
  summary: text,
  before: z.record(z.unknown()).nullish(),
  after: z.record(z.unknown()).nullish(),
});
export const validationResponse = z.object({
  generated_at: date,
  passed: count,
  failed: count,
  warnings: count,
  checks: z.array(
    z.object({
      id: text,
      name: text,
      category: z.enum(["hard", "soft", "integrity"]),
      status: z.enum(["pass", "fail", "warn"]),
      violations: count,
      severity: z.enum(["critical", "high", "medium", "low"]),
      description: text,
      details: z.array(z.object({ entity_type: text, entity_id: text, message: text })),
    }),
  ),
});
export const metricsResponse = z.object({
  total_exams: count,
  scheduled: count,
  unassigned: count,
  conflicts: count,
  room_utilization: ratio,
  coverage_by_day: z.array(z.object({ date, scheduled: count, unassigned: count })),
  room_usage: z.array(z.object({ room: text, utilization: ratio })),
  invigilator_workload: z.array(z.object({ name: text, duties: count, max: count })),
});
export const datasetResponse = z.object({
  students: count,
  exams: count,
  rooms: count,
  invigilators: count,
  enrollments: count.optional(),
});
export const scheduleResponse = z.object({
  run_id: text,
  scheduled: count,
  unassigned: count,
  duration_ms: z.number().nonnegative(),
  unassigned_items: z.array(unassignedResponse).default([]),
});
export const healthResponse = z.object({
  status: text,
  version: text.optional(),
  database: text.optional(),
});
