import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, getSettings, saveSettings } from "@/lib/settings";
import { validateSchedule } from "@/lib/schedule-validation";
import { toCsv } from "@/lib/export";
import { buildDemoDataset } from "@/lib/demo";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("Scheduling inputs", () => {
  it("accepts the current defaults", () => expect(validateSchedule(DEFAULT_SETTINGS)).toBeNull());
  it.each([
    { start_date: "" },
    { end_date: "2026-02-30" },
    { end_date: "2026-12-01" },
    { daily_start: "" },
    { daily_end: "09:00" },
    { daily_end: "25:00" },
    { seed: NaN },
    { seed: 1.5 },
    { break_buffer_minutes: -1 },
    { break_buffer_minutes: Infinity },
  ])("rejects invalid input %j", (change) =>
    expect(validateSchedule({ ...DEFAULT_SETTINGS, ...change })).not.toBeNull(),
  );
  it("reads newly saved preferences and ignores corrupt stored values", () => {
    saveSettings({ ...DEFAULT_SETTINGS, seed: 42, start_date: "2026-12-08" });
    expect(getSettings()).toMatchObject({ seed: 42, start_date: "2026-12-08" });
    localStorage.setItem("examflow.settings", '{"daily_end":"bad"}');
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
describe("Demo CSV export", () => {
  it("escapes quotes, commas and newlines, and neutralizes spreadsheet formulas", () => {
    const row = {
      ...buildDemoDataset().schedules[0],
      course_name: '=HYPERLINK("https://example.com")',
      room_name: 'Hall, "A"\nNorth',
    };
    const csv = toCsv([row]);
    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('"Hall, ""A""\nNorth"');
    expect(csv.split("\r\n")[0]).toContain("exam_id");
  });
});
