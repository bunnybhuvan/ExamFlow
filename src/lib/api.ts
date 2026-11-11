// Central typed API client for the ExamFlow FastAPI backend.
import type {
  AuditEvent, Exam, ExamInput, ExportFormat, GenerateDatasetParams, GenerateDatasetResult,
  GenerateScheduleParams, GenerateScheduleResult, HealthStatus, Invigilator, Metrics, Room,
  ScheduleAssignment, Student, UnassignedExam, ValidationReport,
} from "./types";

export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number | null, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
  get isNetwork() { return this.status === null; }
}

async function request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 15000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(rest.body ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    });
  } catch (e) {
    throw new ApiError(
      (e as Error).name === "AbortError" ? "Request timed out" : `Cannot reach API at ${API_BASE_URL}`,
      null,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* not json */ }
    const detail = (body as { detail?: unknown })?.detail;
    throw new ApiError(typeof detail === "string" ? detail : `${res.status} ${res.statusText}`, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Accepts bare arrays or common envelope shapes ({items}, {data}, {results}). */
function list<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const o = raw as Record<string, unknown> | null;
  for (const k of ["items", "data", "results"]) if (o && Array.isArray(o[k])) return o[k] as T[];
  return [];
}

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, body?: unknown, timeoutMs?: number) =>
  request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined, timeoutMs });

export const api = {
  health: () => get<HealthStatus>("/health"),
  healthDatabase: () => get<HealthStatus>("/health/database"),
  generateDataset: (p: GenerateDatasetParams) => post<GenerateDatasetResult>("/datasets/generate", p, 120000),
  students: async () => list<Student>(await get("/students")),
  exams: async () => list<Exam>(await get("/exams")),
  createExam: (e: ExamInput) => post<Exam>("/exams", e),
  updateExam: (id: string, e: ExamInput) => request<Exam>(`/exams/${id}`, { method: "PUT", body: JSON.stringify(e) }),
  deleteExam: (id: string) => request<void>(`/exams/${id}`, { method: "DELETE" }),
  rooms: async () => list<Room>(await get("/rooms")),
  invigilators: async () => list<Invigilator>(await get("/invigilators")),
  generateSchedule: (p: GenerateScheduleParams) => post<GenerateScheduleResult>("/schedules/generate", p, 300000),
  schedules: async () => list<ScheduleAssignment>(await get("/schedules")),
  unassigned: async () => list<UnassignedExam>(await get("/schedules/unassigned")),
  validation: () => get<ValidationReport>("/reports/validation"),
  metrics: () => get<Metrics>("/reports/metrics"),
  audit: async () => list<AuditEvent>(await get("/audit")),
  exportFile: async (format: ExportFormat): Promise<{ blob: Blob; filename: string }> => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/exports/${format}`);
    } catch {
      throw new ApiError(`Cannot reach API at ${API_BASE_URL}`, null);
    }
    if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status);
    const cd = res.headers.get("content-disposition") ?? "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return { blob: await res.blob(), filename: match?.[1] ?? `examflow-schedule.${format}` };
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