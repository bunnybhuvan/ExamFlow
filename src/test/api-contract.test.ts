import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, API_BASE_URL } from "@/lib/api";
import { buildDemoDataset } from "@/lib/demo";
import { DEFAULT_SETTINGS } from "@/lib/settings";

afterEach(() => vi.unstubAllGlobals());
const respond = (body: unknown, status = 200) => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

describe("FastAPI response handling", () => {
  it.each(["bare", "items", "data", "results"])("reads %s list responses", async (shape) => {
    const rows = buildDemoDataset().exams.slice(0, 1);
    respond(shape === "bare" ? rows : { [shape]: rows });
    expect(await api.exams()).toEqual(rows);
  });
  it("rejects an unknown envelope instead of pretending no exams exist", async () => {
    respond({ exams: [] });
    await expect(api.exams()).rejects.toThrow("Invalid list response");
  });
  it("rejects malformed rows before they reach the UI", async () => {
    respond([{ id: "broken" }]);
    await expect(api.exams()).rejects.toThrow("Invalid API response from /exams");
  });
  it("surfaces FastAPI errors without falling back to demo", async () => {
    respond({ detail: "Database is locked" }, 503);
    await expect(api.exams()).rejects.toMatchObject({ status: 503, message: "Database is locked" });
  });
  it("classifies unreachable requests as network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api.exams()).rejects.toMatchObject({ status: null, isNetwork: true });
  });
  it("reports malformed JSON as an API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not JSON")));
    await expect(api.metrics()).rejects.toBeInstanceOf(ApiError);
  });
  it("posts the scheduling contract and accepts an omitted optional reasons list", async () => {
    const fetch = respond({ run_id: "run-1", scheduled: 2, unassigned: 0, duration_ms: 10 });
    const { start_date, end_date, daily_start, daily_end, break_buffer_minutes, seed, strategy } =
      DEFAULT_SETTINGS;
    const params = {
      start_date,
      end_date,
      daily_start,
      daily_end,
      break_buffer_minutes,
      seed,
      strategy,
    };
    expect((await api.generateSchedule(params)).unassigned_items).toEqual([]);
    expect(fetch.mock.calls[0][0]).toBe(`${API_BASE_URL}/schedules/generate`);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(params);
  });
  it("uses POST/PUT/DELETE exam endpoints and preserves request fields", async () => {
    const exam = buildDemoDataset().exams[0];
    const { id, ...input } = exam;
    const fetch = respond(exam);
    await api.createExam(input);
    await api.updateExam("exam/a", input);
    fetch.mockResolvedValue(new Response(null, { status: 204 }));
    await api.deleteExam("exam/a");
    expect(fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      [`${API_BASE_URL}/exams`, "POST"],
      [`${API_BASE_URL}/exams/exam%2Fa`, "PUT"],
      [`${API_BASE_URL}/exams/exam%2Fa`, "DELETE"],
    ]);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(input);
  });
  it("decodes export filenames and returns the server file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("id,exam", {
          headers: { "content-disposition": "attachment; filename*=UTF-8''exam%20schedule.csv" },
        }),
      ),
    );
    const result = await api.exportFile("csv");
    expect(result.filename).toBe("exam schedule.csv");
    expect(await result.blob.text()).toBe("id,exam");
  });
  it("reads the supplied edge-case endpoint without inventing its schema", async () => {
    const fetch = respond([{ label: "room closure" }]);
    expect(await api.edgeCases()).toEqual([{ label: "room closure" }]);
    expect(fetch.mock.calls[0][0]).toBe(`${API_BASE_URL}/edge-cases`);
  });
});
