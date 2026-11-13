// Local scheduling preferences (persisted in the browser; sent with generate requests).
import { DEMO_SEED } from "./demo";
import { validateSchedule } from "./schedule-validation";
export interface SchedulingSettings {
  start_date: string;
  end_date: string;
  daily_start: string;
  daily_end: string;
  break_buffer_minutes: number;
  seed: number;
  strategy: "balanced" | "compact" | "spread";
  max_exams_per_student_per_day: number;
  allow_weekends: boolean;
}
export const DEFAULT_SETTINGS: SchedulingSettings = {
  start_date: "2026-12-07",
  end_date: "2026-12-18",
  daily_start: "09:00",
  daily_end: "19:00",
  break_buffer_minutes: 30,
  seed: DEMO_SEED,
  strategy: "balanced",
  max_exams_per_student_per_day: 2,
  allow_weekends: false,
};
const KEY = "examflow.settings";
export function getSettings(): SchedulingSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    return validateSchedule(settings) ? DEFAULT_SETTINGS : settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: SchedulingSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
