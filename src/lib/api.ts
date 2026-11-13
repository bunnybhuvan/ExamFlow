// Central typed API client for the ExamFlow FastAPI backend.
import { z } from "zod";
import {
  examResponse,
  studentResponse,
  roomResponse,
  invigilatorResponse,
  assignmentResponse,
  unassignedResponse,
  auditResponse,
  validationResponse,
  metricsResponse,
  datasetResponse,
  scheduleResponse,
  healthResponse,
} from "./api-schemas";
import type {
  AuditEvent,
  Exam,
  ExamInput,
  ExportFormat,
  GenerateDatasetParams,
  GenerateDatasetResult,
  GenerateScheduleParams,
  GenerateScheduleResult,
  HealthStatus,
  Invigilator,
  Metrics,
  Room,
  ScheduleAssignment,
  Student,
  UnassignedExam,
  ValidationReport,
} from "./types";

export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number | null,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get isNetwork() {
    return this.status === null;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 15000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...rest.headers,
      },
    });
  } catch (e) {
    throw new ApiError(
      (e as Error).name === "AbortError"
        ? "Request timed out"
        : `Cannot reach API at ${API_BASE_URL}`,
      null,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      /* not json */
    }
    const detail = (body as { detail?: unknown })?.detail;
    throw new ApiError(
      typeof detail === "string" ? detail : `${res.status} ${res.statusText}`,
      res.status,
      body,
    );
  }
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(`Invalid JSON response from ${path}`, res.status);
  }
}

/** Accepts bare arrays or common envelope shapes ({items}, {data}, {results}). */
function list<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const o = raw as Record<string, unknown> | null;
  for (const k of ["items", "data", "results"]) if (o && Array.isArray(o[k])) return o[k] as T[];
  throw new ApiError(
    "Invalid list response: expected an array or items/data/results envelope",
    200,
    raw,
  );
}

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown, path: string): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new ApiError(
      `Invalid API response from ${path}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      200,
    );
  return result.data;
}
const read = async <T>(p: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  parse(schema, await get(p), p);
const readList = async <T>(p: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
  parse(z.array(schema), list(await get(p)), p);

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, body?: unknown, timeoutMs?: number) =>
  request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined, timeoutMs });

export const api = {
  health: () => read("/health", healthResponse),
  healthDatabase: () => read("/health/database", healthResponse),
  generateDataset: async (p: GenerateDatasetParams) =>
    parse(datasetResponse, await post("/datasets/generate", p, 120000), "/datasets/generate"),
  students: () => readList("/students", studentResponse),
  exams: () => readList("/exams", examResponse),
  createExam: async (e: ExamInput) => parse(examResponse, await post("/exams", e), "/exams"),
  updateExam: async (id: string, e: ExamInput) =>
    parse(
      examResponse,
      await request(`/exams/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(e) }),
      "/exams",
    ),
  deleteExam: (id: string) =>
    request<void>(`/exams/${encodeURIComponent(id)}`, { method: "DELETE" }),
  rooms: () => readList("/rooms", roomResponse),
  invigilators: () => readList("/invigilators", invigilatorResponse),
  generateSchedule: async (p: GenerateScheduleParams) =>
    parse(scheduleResponse, await post("/schedules/generate", p, 300000), "/schedules/generate"),
  schedules: () => readList("/schedules", assignmentResponse),
  unassigned: () => readList("/schedules/unassigned", unassignedResponse),
  validation: () => read("/reports/validation", validationResponse),
  metrics: () => read("/reports/metrics", metricsResponse),
  audit: () => readList("/audit", auditResponse),
  edgeCases: () => readList("/edge-cases", z.record(z.unknown())),
  exportFile: async (format: ExportFormat): Promise<{ blob: Blob; filename: string }> => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/exports/${format}`, {
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ApiError(`Cannot reach API at ${API_BASE_URL}`, null);
    }
    if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status);
    const cd = res.headers.get("content-disposition") ?? "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    let filename = match?.[1] ?? `examflow-schedule.${format}`;
    try {
      filename = decodeURIComponent(filename);
    } catch {
      /* keep literal filename */
    }
    return {
      blob: await res.blob(),
      filename: filename.split(/[\\/]/).at(-1) || `examflow-schedule.${format}`,
    };
  },
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}