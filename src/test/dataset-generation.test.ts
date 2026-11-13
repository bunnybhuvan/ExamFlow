import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DATASET_PARAMS, PRESETS, isDatasetInvalid } from "@/lib/dataset-validation";
import { api, API_BASE_URL } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("dataset generation configuration", () => {
  it("defaults edge cases to false", () => {
    expect(DEFAULT_DATASET_PARAMS.include_edge_cases).toBe(false);
  });
  it("uses the exact Faculty scale", () => {
    expect(PRESETS.find((p) => p.label === "Faculty")?.p).toEqual({
      students: 5000,
      exams: 300,
      rooms: 100,
      invigilators: 200,
    });
  });
  it("keeps the other presets unchanged", () => {
    expect(PRESETS.filter((p) => p.label !== "Faculty")).toEqual([
      { label: "Small", p: { students: 500, exams: 60, rooms: 15, invigilators: 30 } },
      { label: "University", p: { students: 25000, exams: 1800, rooms: 220, invigilators: 600 } },
    ]);
  });
  it("validates numeric fields without treating the boolean as a number", () => {
    expect(isDatasetInvalid(DEFAULT_DATASET_PARAMS)).toBe(false);
    expect(isDatasetInvalid({ ...DEFAULT_DATASET_PARAMS, include_edge_cases: true })).toBe(false);
    expect(isDatasetInvalid({ ...DEFAULT_DATASET_PARAMS, rooms: NaN })).toBe(true);
  });
  it.each([false, true])(
    "posts include_edge_cases=%s to the real endpoint",
    async (include_edge_cases) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ students: 5000, exams: 300, rooms: 100, invigilators: 200 }),
            { status: 200 },
          ),
        );
      vi.stubGlobal("fetch", fetchMock);
      const params = { ...DEFAULT_DATASET_PARAMS, include_edge_cases };
      await api.generateDataset(params);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`${API_BASE_URL}/datasets/generate`);
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual(params);
    },
  );
});
