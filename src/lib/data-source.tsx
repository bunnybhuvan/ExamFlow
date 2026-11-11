// Decides between live API and demo fixture. The two are never mixed: every query key
// is namespaced by mode, and demo data only loads after the health check fails.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { buildDemoDataset, demoGenerateSchedule, DEMO_SEED, type DemoDataset } from "./demo";
import type { Exam, ExamInput, GenerateDatasetParams, GenerateScheduleParams } from "./types";

export type DataMode = "checking" | "api" | "demo";

interface Ctx {
  mode: DataMode;
  healthError: string | null;
  retry: () => void;
  demo: React.MutableRefObject<DemoDataset>;
  setDemo: (d: DemoDataset) => void;
}
const DataSourceContext = createContext<Ctx | null>(null);

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    retry: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });
  const demo = useRef<DemoDataset>(buildDemoDataset(DEMO_SEED));
  const [, bump] = useState(0);
  const mode: DataMode = health.isPending ? "checking" : health.isSuccess ? "api" : "demo";
  const setDemo = useCallback((d: DemoDataset) => {
    demo.current = d;
    bump((n) => n + 1);
    qc.invalidateQueries({ queryKey: ["demo"] });
  }, [qc]);
  const value = useMemo<Ctx>(() => ({
    mode,
    healthError: health.error ? (health.error as Error).message : null,
    retry: () => health.refetch(),
    demo, setDemo,
  }), [mode, health.error, health, setDemo]);
  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>;
}

export function useDataSource() {
  const c = useContext(DataSourceContext);
  if (!c) throw new Error("useDataSource must be used within DataSourceProvider");
  return c;
}

type DemoKey = Exclude<keyof DemoDataset, never>;
type ApiFn = Record<DemoKey, () => Promise<unknown>>;
const apiFns: ApiFn = {
  exams: api.exams, students: api.students, rooms: api.rooms, invigilators: api.invigilators,
  schedules: api.schedules, unassigned: api.unassigned, validation: api.validation, metrics: api.metrics, audit: api.audit,
};

function useResource<K extends DemoKey>(key: K) {
  const { mode, demo } = useDataSource();
  return useQuery<DemoDataset[K], ApiError>({
    queryKey: [mode, key],
    enabled: mode !== "checking",
    retry: (n, e) => !(e instanceof ApiError && e.status && e.status < 500) && n < 1,
    queryFn: async () => (mode === "api" ? ((await apiFns[key]()) as DemoDataset[K]) : structuredClone(demo.current[key])),
  });
}

export const useExams = () => useResource("exams");
export const useStudents = () => useResource("students");
export const useRooms = () => useResource("rooms");
export const useInvigilators = () => useResource("invigilators");
export const useSchedules = () => useResource("schedules");
export const useUnassigned = () => useResource("unassigned");
export const useValidation = () => useResource("validation");
export const useMetrics = () => useResource("metrics");
export const useAudit = () => useResource("audit");

export function useDatabaseHealth() {
  const { mode } = useDataSource();
  return useQuery({ queryKey: ["health-db"], queryFn: api.healthDatabase, enabled: mode === "api", retry: 0 });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  const { mode } = useDataSource();
  return () => qc.invalidateQueries({ queryKey: [mode] });
}

export function useGenerateSchedule() {
  const { mode, setDemo } = useDataSource();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (p: GenerateScheduleParams) => {
      if (mode === "api") return { ...(await api.generateSchedule(p)), demo: false };
      await new Promise((r) => setTimeout(r, 900));
      const { dataset, result } = demoGenerateSchedule(p);
      setDemo(dataset);
      return { ...result, demo: true };
    },
    onSuccess: () => invalidate(),
  });
}

export function useGenerateDataset() {
  const { mode, setDemo } = useDataSource();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (p: GenerateDatasetParams) => {
      if (mode === "api") return { ...(await api.generateDataset(p)), demo: false };
      const d = buildDemoDataset(p.seed);
      setDemo(d);
      return { students: d.students.length, exams: d.exams.length, rooms: d.rooms.length, invigilators: d.invigilators.length, demo: true };
    },
    onSuccess: () => invalidate(),
  });
}

/** Exam CRUD. The listed backend contract has no write endpoints for exams; we call the
 *  conventional REST routes and surface the backend's real response (e.g. 404/405). */
export function useExamMutations() {
  const { mode, demo, setDemo } = useDataSource();
  const invalidate = useInvalidateAll();
  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ExamInput }): Promise<Exam> => {
      if (mode === "api") return id ? api.updateExam(id, input) : api.createExam(input);
      const d = demo.current;
      const exam: Exam = { ...input, id: id ?? `exam-${Date.now()}` };
      setDemo({ ...d, exams: id ? d.exams.map((e) => (e.id === id ? exam : e)) : [exam, ...d.exams] });
      return exam;
    },
    onSuccess: () => invalidate(),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (mode === "api") return api.deleteExam(id);
      setDemo({ ...demo.current, exams: demo.current.exams.filter((e) => e.id !== id) });
    },
    onSuccess: () => invalidate(),
  });
  return { save, remove };
}