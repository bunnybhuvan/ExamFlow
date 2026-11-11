// Deterministic, clearly-labelled demo fixture. Used ONLY when the API is unreachable.
import type {
  AuditEvent, Exam, GenerateScheduleParams, GenerateScheduleResult, Invigilator, Metrics, Room,
  ScheduleAssignment, Student, UnassignedExam, ValidationReport,
} from "./types";

export const DEMO_SEED = 20261111;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEPTS = ["Computer Science", "Mathematics", "Physics", "Chemistry", "Economics", "Biology", "History", "Engineering"];
const PREFIX: Record<string, string> = { "Computer Science": "CS", Mathematics: "MATH", Physics: "PHYS", Chemistry: "CHEM", Economics: "ECON", Biology: "BIO", History: "HIST", Engineering: "ENG" };
const TOPICS = ["Foundations", "Advanced Methods", "Systems", "Theory", "Applied Analysis", "Laboratory Practice", "Modelling", "Seminar", "Data Structures", "Statistics", "Thermodynamics", "Organic Synthesis"];
const EQUIP = ["Computers", "Projector", "Lab benches", "Calculators", "Audio system"];
const ACCOMM = ["Extra time 25%", "Separate room", "Accessible seating", "Screen reader"];
const FIRST = ["Aarav", "Maya", "Liam", "Sofia", "Noah", "Zara", "Ethan", "Priya", "Lucas", "Amara", "Kenji", "Elena", "Omar", "Isla", "Mateo", "Hana", "Ravi", "Chloe", "Diego", "Nia"];
const LAST = ["Patel", "Chen", "Okafor", "Garcia", "Kim", "Novak", "Haddad", "Singh", "Rossi", "Mensah", "Larsen", "Ito", "Silva", "Dubois", "Kowalski"];
const BUILDINGS = ["Turing Hall", "Curie Centre", "Keynes Building", "Darwin Wing"];

export const DEMO_START = "2026-12-07";
const DAYS = Array.from({ length: 10 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 11, 7));
  d.setUTCDate(d.getUTCDate() + i + Math.floor(i / 5) * 2); // weekdays only
  return d.toISOString().slice(0, 10);
});
const SLOTS = ["09:00", "13:00", "16:30"];

function pick<T>(r: () => number, arr: T[]) { return arr[Math.floor(r() * arr.length)]; }
function pickSome<T>(r: () => number, arr: T[], p: number) { return arr.filter(() => r() < p); }

export interface DemoDataset {
  exams: Exam[]; students: Student[]; rooms: Room[]; invigilators: Invigilator[];
  schedules: ScheduleAssignment[]; unassigned: UnassignedExam[]; validation: ValidationReport;
  metrics: Metrics; audit: AuditEvent[];
}

function addMinutes(iso: string, m: number) { return new Date(new Date(iso).getTime() + m * 60000).toISOString(); }

export function buildDemoDataset(seed = DEMO_SEED, params?: Partial<GenerateScheduleParams>): DemoDataset {
  const r = rng(seed);
  const rooms: Room[] = Array.from({ length: 12 }, (_, i) => {
    const capacity = [40, 60, 80, 120, 200, 30][i % 6];
    return {
      id: `room-${i + 1}`, name: `${BUILDINGS[i % 4].split(" ")[0]} ${100 + i * 7}`, building: BUILDINGS[i % 4],
      capacity, equipment: pickSome(r, EQUIP, 0.4), accessible: r() > 0.3,
      closures: r() > 0.75 ? [{ start: DAYS[3], end: DAYS[4], reason: pick(r, ["Maintenance", "Conference booking", "HVAC repair"]) }] : [],
      utilization: 0,
    };
  });
  const exams: Exam[] = Array.from({ length: 48 }, (_, i) => {
    const dept = DEPTS[i % DEPTS.length];
    return {
      id: `exam-${i + 1}`, course_code: `${PREFIX[dept]}${100 + ((i * 37) % 400)}`,
      course_name: `${dept.split(" ")[0]} ${pick(r, TOPICS)}`, department: dept,
      duration_minutes: pick(r, [90, 120, 120, 180]), enrollment: Math.floor(20 + r() * 170),
      window_start: DAYS[0], window_end: DAYS[DAYS.length - 1],
      required_equipment: r() > 0.7 ? [pick(r, EQUIP)] : [], accommodations: pickSome(r, ACCOMM, 0.15),
      status: "pending",
    };
  });
  const students: Student[] = Array.from({ length: 120 }, (_, i) => {
    const f = FIRST[i % FIRST.length], l = LAST[(i * 7) % LAST.length];
    const enrolls = Array.from(new Set(Array.from({ length: 3 + Math.floor(r() * 3) }, () => pick(r, exams).course_code)));
    return {
      id: `stu-${String(i + 1).padStart(4, "0")}`, name: `${f} ${l}`, email: `${f}.${l}${i}@uni.edu`.toLowerCase(),
      program: pick(r, DEPTS), year: 1 + Math.floor(r() * 4), enrollments: enrolls,
      accommodations: r() > 0.88 ? [pick(r, ACCOMM)] : [],
    };
  });
  const invigilators: Invigilator[] = Array.from({ length: 20 }, (_, i) => ({
    id: `inv-${i + 1}`, name: `Dr. ${FIRST[(i * 3) % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`,
    email: `inv${i + 1}@uni.edu`, department: DEPTS[i % DEPTS.length],
    qualifications: pickSome(r, [...EQUIP, "Accessibility trained"], 0.35),
    available_days: DAYS.filter(() => r() > 0.25), max_duties: 4 + Math.floor(r() * 4), assigned_duties: 0, conflicts: 0,
  }));

  // Simple deterministic greedy scheduler.
  const buffer = params?.break_buffer_minutes ?? 30;
  const order = [...exams].sort((a, b) => b.enrollment - a.enrollment);
  const used = new Set<string>();
  const schedules: ScheduleAssignment[] = [];
  const unassigned: UnassignedExam[] = [];
  let k = 0;
  for (const ex of order) {
    let placed = false;
    if (r() < 0.08) {
      unassigned.push({ exam_id: ex.id, course_code: ex.course_code, course_name: ex.course_name,
        ...pick(r, [
          { reason_code: "NO_ROOM_CAPACITY", reason: "No room with sufficient capacity is free in the exam window." },
          { reason_code: "STUDENT_CLASH", reason: "Every candidate slot clashes with another exam for enrolled students." },
          { reason_code: "NO_INVIGILATOR", reason: "No qualified invigilator is available in the remaining slots." },
        ]) });
      ex.status = "unassigned";
      continue;
    }
    for (let t = 0; t < DAYS.length * SLOTS.length && !placed; t++) {
      const slot = (k + t) % (DAYS.length * SLOTS.length);
      const day = DAYS[slot % DAYS.length], time = SLOTS[Math.floor(slot / DAYS.length)];
      const room = rooms.filter((rm) => rm.capacity >= ex.enrollment && !used.has(`${rm.id}|${day}|${time}`))
        .sort((a, b) => a.capacity - b.capacity)[0];
      if (!room) continue;
      const invs = invigilators.filter((v) => v.available_days.includes(day) && v.assigned_duties < v.max_duties)
        .slice(0, ex.enrollment > 100 ? 2 : 1);
      if (!invs.length) continue;
      used.add(`${room.id}|${day}|${time}`);
      invs.forEach((v) => v.assigned_duties++);
      const start = `${day}T${time}:00.000Z`;
      const conflict = r() < 0.06;
      schedules.push({
        id: `asg-${schedules.length + 1}`, exam_id: ex.id, course_code: ex.course_code, course_name: ex.course_name,
        room_id: room.id, room_name: room.name, invigilator_ids: invs.map((v) => v.id), start,
        end: addMinutes(start, ex.duration_minutes), enrolled: ex.enrollment, capacity: room.capacity,
        status: conflict ? "conflict" : r() > 0.85 ? "tentative" : "confirmed",
      });
      ex.status = conflict ? "conflict" : "scheduled";
      if (conflict) invs.forEach((v) => v.conflicts++);
      placed = true;
    }
    k += 1;
    if (!placed) {
      unassigned.push({ exam_id: ex.id, course_code: ex.course_code, course_name: ex.course_name, reason_code: "NO_FEASIBLE_SLOT", reason: `No slot satisfies capacity, availability and the ${buffer}-minute break buffer.` });
      ex.status = "unassigned";
    }
  }
  exams.slice(0, 3).forEach((e) => { if (e.status === "pending") e.status = "draft"; });
  const slotsPerRoom = DAYS.length * SLOTS.length;
  rooms.forEach((rm) => {
    const n = schedules.filter((s) => s.room_id === rm.id);
    rm.utilization = n.length / slotsPerRoom;
  });

  const conflictAsg = schedules.filter((s) => s.status === "conflict");
  const checks: ValidationReport["checks"] = [
    { id: "hc-room-capacity", name: "Room capacity respected", category: "hard", status: "pass", violations: 0, severity: "critical", description: "Every assigned room seats all enrolled candidates.", details: [] },
    { id: "hc-room-double", name: "No room double-booking", category: "hard", status: "pass", violations: 0, severity: "critical", description: "A room hosts at most one exam per slot.", details: [] },
    { id: "hc-student-clash", name: "No student exam clashes", category: "hard", status: conflictAsg.length ? "fail" : "pass", violations: conflictAsg.length, severity: "critical", description: "No student sits two exams at overlapping times.",
      details: conflictAsg.map((s) => ({ entity_type: "exam", entity_id: s.exam_id, message: `${s.course_code} overlaps another exam for shared students.` })) },
    { id: "hc-invigilator", name: "Invigilator coverage", category: "hard", status: "pass", violations: 0, severity: "high", description: "Each exam has at least one available invigilator.", details: [] },
    { id: "hc-closures", name: "Room closures honoured", category: "hard", status: "pass", violations: 0, severity: "high", description: "No exams placed during closures.", details: [] },
    { id: "sc-buffer", name: `Break buffer ≥ ${buffer} min`, category: "soft", status: "warn", violations: 3, severity: "medium", description: "Students get a rest buffer between consecutive exams.",
      details: students.slice(4, 7).map((s) => ({ entity_type: "student", entity_id: s.id, message: `${s.name} has back-to-back exams on ${DAYS[2]}.` })) },
    { id: "sc-workload", name: "Balanced invigilator workload", category: "soft", status: "pass", violations: 0, severity: "low", description: "Duties spread evenly across staff.", details: [] },
    { id: "di-unassigned", name: "All exams assigned", category: "integrity", status: unassigned.length ? "fail" : "pass", violations: unassigned.length, severity: "high", description: "Every active exam has a schedule assignment.",
      details: unassigned.map((u) => ({ entity_type: "exam", entity_id: u.exam_id, message: `${u.course_code}: ${u.reason_code}` })) },
    { id: "di-enrol-ref", name: "Enrollment references valid", category: "integrity", status: "pass", violations: 0, severity: "medium", description: "All enrollments reference existing exams.", details: [] },
    { id: "di-accomm", name: "Accommodation rooms accessible", category: "integrity", status: "warn", violations: 1, severity: "medium", description: "Exams with accommodations use accessible rooms.",
      details: [{ entity_type: "room", entity_id: rooms.find((x) => !x.accessible)?.id ?? "room-1", message: "Hosts an exam with accessibility accommodations." }] },
  ];
  const validation: ValidationReport = {
    generated_at: "2026-11-11T09:00:00.000Z",
    passed: checks.filter((c) => c.status === "pass").length,
    failed: checks.filter((c) => c.status === "fail").length,
    warnings: checks.filter((c) => c.status === "warn").length, checks,
  };
  const metrics: Metrics = {
    total_exams: exams.length, scheduled: schedules.length, unassigned: unassigned.length, conflicts: conflictAsg.length,
    room_utilization: rooms.reduce((a, b) => a + b.utilization, 0) / rooms.length,
    coverage_by_day: DAYS.map((d) => ({ date: d, scheduled: schedules.filter((s) => s.start.startsWith(d)).length, unassigned: 0 })),
    room_usage: rooms.map((rm) => ({ room: rm.name, utilization: rm.utilization })),
    invigilator_workload: invigilators.map((v) => ({ name: v.name, duties: v.assigned_duties, max: v.max_duties })),
  };
  const actors = ["registrar@uni.edu", "scheduler-engine", "ops.lead@uni.edu"];
  const audit: AuditEvent[] = Array.from({ length: 24 }, (_, i) => {
    const ex = exams[i % exams.length];
    const kinds = [
      { action: "schedule.generated", entity_type: "schedule", summary: `Schedule run completed: ${schedules.length} assigned, ${unassigned.length} unassigned` },
      { action: "exam.updated", entity_type: "exam", summary: `${ex.course_code} duration changed`, before: { duration_minutes: 90 }, after: { duration_minutes: ex.duration_minutes } },
      { action: "room.closure_added", entity_type: "room", summary: `Closure added to ${rooms[i % 12].name}`, before: { closures: [] }, after: { closures: [{ reason: "Maintenance" }] } },
      { action: "assignment.moved", entity_type: "assignment", summary: `${ex.course_code} moved to new slot`, before: { start: `${DAYS[1]}T09:00` }, after: { start: `${DAYS[2]}T13:00` } },
      { action: "dataset.generated", entity_type: "dataset", summary: "Synthetic dataset generated" },
    ];
    const kd = kinds[i % kinds.length];
    return { id: `evt-${1000 - i}`, timestamp: new Date(Date.UTC(2026, 10, 11, 9, 0) - i * 47 * 60000).toISOString(), actor: pick(r, actors), entity_id: kd.entity_type === "room" ? rooms[i % 12].id : ex.id, ...kd };
  });
  return { exams, students, rooms, invigilators, schedules, unassigned, validation, metrics, audit };
}

export function demoGenerateSchedule(p: GenerateScheduleParams): { dataset: DemoDataset; result: GenerateScheduleResult } {
  const t0 = performance.now();
  const dataset = buildDemoDataset(p.seed, p);
  return {
    dataset,
    result: { run_id: `demo-${p.seed}`, scheduled: dataset.schedules.length, unassigned: dataset.unassigned.length, duration_ms: Math.round(performance.now() - t0), unassigned_items: dataset.unassigned },
  };
}