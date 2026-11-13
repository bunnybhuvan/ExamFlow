import type { GenerateScheduleParams } from "./types";

export function validateSchedule(p: GenerateScheduleParams): string | null {
  const date = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(`${s}T00:00:00Z`)) &&
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  const time = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if (!date(p.start_date) || !date(p.end_date)) return "Enter valid start and end dates.";
  if (p.end_date < p.start_date) return "End date must be on or after start date.";
  if (!time(p.daily_start) || !time(p.daily_end)) return "Enter valid daily start and end times.";
  if (p.daily_end <= p.daily_start) return "Daily end must be after daily start.";
  if (!Number.isInteger(p.break_buffer_minutes) || p.break_buffer_minutes < 0)
    return "Buffer must be a non-negative whole number.";
  if (!Number.isSafeInteger(p.seed)) return "Seed must be a safe whole number.";
  if (!["balanced", "compact", "spread"].includes(p.strategy)) return "Choose a valid strategy.";
  return null;
}