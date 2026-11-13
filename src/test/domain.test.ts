import { describe, expect, it } from "vitest";
import { buildDemoDataset, DEMO_SEED } from "@/lib/demo";
import { deriveConflicts } from "@/lib/conflicts";
import { API_BASE_URL } from "@/lib/api";

describe("demo fixture", () => {
  it("is deterministic for the same seed", () => {
    expect(JSON.stringify(buildDemoDataset(DEMO_SEED))).toBe(
      JSON.stringify(buildDemoDataset(DEMO_SEED)),
    );
  });
  it("never places an exam in a room smaller than its enrollment", () => {
    const d = buildDemoDataset(DEMO_SEED);
    for (const a of d.schedules) expect(a.enrolled).toBeLessThanOrEqual(a.capacity);
  });
});

describe("conflicts", () => {
  it("lists every unassigned exam and sorts critical first", () => {
    const d = buildDemoDataset(DEMO_SEED);
    const c = deriveConflicts(d.validation, d.unassigned);
    expect(c.filter((x) => x.category === "Unassigned")).toHaveLength(d.unassigned.length);
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < c.length; i++)
      expect(rank[c[i].severity]).toBeGreaterThanOrEqual(rank[c[i - 1].severity]);
  });
});

describe("api", () => {
  it("defaults to the local FastAPI base URL", () => {
    expect(API_BASE_URL).toBe("http://localhost:8000/api/v1");
  });
});