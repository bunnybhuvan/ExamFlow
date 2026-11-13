import type { ScheduleAssignment } from "./types";

export function toCsv(rows: ScheduleAssignment[]) {
  const head = [
    "id",
    "exam_id",
    "course_code",
    "course_name",
    "room_name",
    "start",
    "end",
    "enrolled",
    "capacity",
    "status",
    "invigilators",
  ];
  const esc = (v: unknown) => {
    const text = String(v);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [
    head.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.exam_id,
        r.course_code,
        r.course_name,
        r.room_name,
        r.start,
        r.end,
        r.enrolled,
        r.capacity,
        r.status,
        r.invigilator_ids.join(";"),
      ]
        .map(esc)
        .join(","),
    ),
  ].join("\r\n");
}
