import type { Conflict, ScheduleAssignment, UnassignedExam, ValidationReport } from "./types";

const REMEDIATION: Record<string, string> = {
  NO_ROOM_CAPACITY: "Split the cohort across two rooms, or widen the exam window to reach a larger room.",
  STUDENT_CLASH: "Move one of the clashing exams to another day, or extend the window by a day.",
  NO_INVIGILATOR: "Add availability for qualified staff, or relax the equipment qualification requirement.",
  NO_FEASIBLE_SLOT: "Reduce the break buffer, extend daily hours, or widen the date window.",
  "hc-student-clash": "Reschedule one exam in the pair; check shared enrollments in Students.",
  "sc-buffer": "Increase spacing in Settings or move one of the consecutive exams.",
  "di-accomm": "Reassign the exam to an accessible room.",
};

export function deriveConflicts(v?: ValidationReport, u?: UnassignedExam[], s?: ScheduleAssignment[]): Conflict[] {
  const out: Conflict[] = [];
  u?.forEach((x) => out.push({
    id: `u-${x.exam_id}`, category: "Unassigned", severity: "high", reason_code: x.reason_code,
    title: `${x.course_code} could not be scheduled — ${x.reason}`, entity_type: "exam", entity_id: x.exam_id,
    remediation: REMEDIATION[x.reason_code] ?? "Review constraints for this exam and regenerate.",
  }));
  v?.checks.filter((c) => c.status !== "pass" && c.id !== "di-unassigned").forEach((c) =>
    c.details.forEach((d, i) => out.push({
      id: `${c.id}-${i}`, category: c.category === "hard" ? "Hard constraint" : c.category === "soft" ? "Soft constraint" : "Data integrity",
      severity: c.status === "warn" ? (c.severity === "critical" ? "high" : "medium") : c.severity,
      reason_code: c.id.toUpperCase(), title: d.message, entity_type: d.entity_type, entity_id: d.entity_id,
      remediation: REMEDIATION[c.id] ?? c.description,
    })),
  );
  if (!v) s?.filter((a) => a.status === "conflict").forEach((a) => out.push({
    id: `s-${a.id}`, category: "Hard constraint", severity: "critical", reason_code: "ASSIGNMENT_CONFLICT",
    title: `${a.course_code} assignment flagged as conflicting`, entity_type: "exam", entity_id: a.exam_id,
    remediation: REMEDIATION["hc-student-clash"],
  }));
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}