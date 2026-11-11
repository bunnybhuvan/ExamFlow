// Domain models shared by the API client, demo fixtures and UI.
export type ExamStatus = "draft" | "pending" | "scheduled" | "unassigned" | "conflict";
export type Severity = "critical" | "high" | "medium" | "low";

export interface Exam {
  id: string;
  course_code: string;
  course_name: string;
  department: string;
  duration_minutes: number;
  enrollment: number;
  window_start: string; // ISO date
  window_end: string; // ISO date
  required_equipment: string[];
  accommodations: string[];
  status: ExamStatus;
}
export type ExamInput = Omit<Exam, "id">;

export interface Student {
  id: string;
  name: string;
  email: string;
  program: string;
  year: number;
  enrollments: string[]; // course codes
  accommodations: string[];
}

export interface RoomClosure {
  start: string;
  end: string;
  reason: string;
}
export interface Room {
  id: string;
  name: string;
  building: string;
  capacity: number;
  equipment: string[];
  accessible: boolean;
  closures: RoomClosure[];
  utilization: number; // 0..1
}

export interface Invigilator {
  id: string;
  name: string;
  email: string;
  department: string;
  qualifications: string[];
  available_days: string[]; // ISO dates
  max_duties: number;
  assigned_duties: number;
  conflicts: number;
}

export interface ScheduleAssignment {
  id: string;
  exam_id: string;
  course_code: string;
  course_name: string;
  room_id: string;
  room_name: string;
  invigilator_ids: string[];
  start: string; // ISO datetime
  end: string;
  enrolled: number;
  capacity: number;
  status: "confirmed" | "tentative" | "conflict";
}

export interface UnassignedExam {
  exam_id: string;
  course_code: string;
  course_name: string;
  reason_code: string;
  reason: string;
}

export interface ValidationCheck {
  id: string;
  name: string;
  category: "hard" | "soft" | "integrity";
  status: "pass" | "fail" | "warn";
  violations: number;
  severity: Severity;
  description: string;
  details: { entity_type: string; entity_id: string; message: string }[];
}
export interface ValidationReport {
  generated_at: string;
  passed: number;
  failed: number;
  warnings: number;
  checks: ValidationCheck[];
}

export interface Metrics {
  total_exams: number;
  scheduled: number;
  unassigned: number;
  conflicts: number;
  room_utilization: number; // 0..1
  coverage_by_day: { date: string; scheduled: number; unassigned: number }[];
  room_usage: { room: string; utilization: number }[];
  invigilator_workload: { name: string; duties: number; max: number }[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface HealthStatus {
  status: string;
  version?: string;
  database?: string;
}

export interface GenerateScheduleParams {
  start_date: string;
  end_date: string;
  daily_start: string; // HH:mm
  daily_end: string;
  break_buffer_minutes: number;
  seed: number;
  strategy: "balanced" | "compact" | "spread";
}
export interface GenerateScheduleResult {
  run_id: string;
  scheduled: number;
  unassigned: number;
  duration_ms: number;
  unassigned_items: UnassignedExam[];
}

export interface GenerateDatasetParams {
  include_edge_cases: boolean;
  students: number;
  exams: number;
  rooms: number;
  invigilators: number;
  seed: number;
}
export interface GenerateDatasetResult {
  students: number;
  exams: number;
  rooms: number;
  invigilators: number;
  enrollments?: number;
}

export interface Conflict {
  id: string;
  category: string;
  severity: Severity;
  reason_code: string;
  title: string;
  entity_type: string;
  entity_id: string;
  remediation: string;
}

export type ExportFormat = "csv" | "json";