// Decides between live API and demo fixture. The two are never mixed: every query key
// is namespaced by mode, and demo data only loads after the health check fails.
import { useContext } from "react";
import { DataSourceContext, type DataMode } from "./data-source-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { buildDemoDataset, demoGenerateSchedule, type DemoDataset } from "./demo";
import type {
  Exam,
  ExamInput,
  ExportFormat,
  GenerateDatasetParams,
  GenerateScheduleParams,
} from "./types";
import { toCsv } from "./export";

export function useDataSource() {
  const c = useContext(DataSourceContext);
  if (!c) throw new Error("useDataSource must be used within DataSourceProvider");
  return c;
}

type DemoKey = Exclude<keyof DemoDataset, never>;
type ApiFn = Record<DemoKey, () => Promise<unknown>>;
const apiFns: ApiFn = {
  exams: () => api.exams(),
  students: () => api.students(),
  rooms: () => api.rooms(),
  invigilators: () => api.invigilators(),
  schedules: () => api.schedules(),
  unassigned: () => api.unassigned(),
  validation: () => api.validation(),
  metrics: () => api.metrics(),
  audit: () => api.audit(),
};

function useResource<K extends DemoKey>(key: K) {
  const { mode, demo } = useDataSource();
  return useQuery<DemoDataset[K], ApiError>({
    queryKey: [mode, key],
    enabled: mode !== "checking",
    retry: (n, e) => !(e instanceof ApiError && e.status && e.status < 500) && n < 1,
    queryFn: async () =>
      mode === "api"
        ? ((await apiFns[key]()) as DemoDataset[K])
        : structuredClone(demo.current[key]),
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
  return useQuery({
    queryKey: [mode, "health-db"],
    queryFn: api.healthDatabase,
    enabled: mode === "api",
    retry: 0,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  const { mode } = useDataSource();
  return {
    onMutate: () => mode,
    onSuccess: (_data: unknown, _variables: unknown, startedMode: DataMode | undefined) =>
      qc.invalidateQueries({ queryKey: [startedMode ?? mode] }),
  };
}

function assertReady(mode: DataMode) {
  if (mode === "checking") throw new Error("Wait for the API connection check to finish.");
}

export function useExportSchedule() {
  const { mode, demo } = useDataSource();
  return useMutation({
    mutationFn: async (format: ExportFormat) => {
      assertReady(mode);
      if (mode === "api") return { ...(await api.exportFile(format)), demo: false };
      const rows = demo.current.schedules;
      const body =
        format === "csv"
          ? toCsv(rows)
          : JSON.stringify(
              { demo: true, note: "DEMO FIXTURE — not backend data", assignments: rows },
              null,
              2,
            );
      return {
        blob: new Blob([body], { type: format === "csv" ? "text/csv" : "application/json" }),
        filename: `examflow-DEMO-schedule.${format}`,
        demo: true,
      };
    },
  });
}

export function useGenerateSchedule() {
  const { mode, setDemo } = useDataSource();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (p: GenerateScheduleParams) => {
      assertReady(mode);
      if (mode === "api") return { ...(await api.generateSchedule(p)), demo: false };
      await new Promise((r) => setTimeout(r, 900));
      const { dataset, result } = demoGenerateSchedule(p);
      setDemo(dataset);
      return { ...result, demo: true };
    },
    ...invalidate,
  });
}

export function useGenerateDataset() {
  const { mode, setDemo } = useDataSource();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (p: GenerateDatasetParams) => {
      assertReady(mode);
      if (mode === "api") return { ...(await api.generateDataset(p)), demo: false };
      const d = buildDemoDataset(p.seed);
      setDemo(d);
      return {
        students: d.students.length,
        exams: d.exams.length,
        rooms: d.rooms.length,
        invigilators: d.invigilators.length,
        demo: true,
      };
    },
    ...invalidate,
  });
}

/** Exam CRUD uses the supplied REST contract and surfaces real backend failures. */
export function useExamMutations() {
  const { mode, demo, setDemo } = useDataSource();
  const invalidate = useInvalidateAll();
  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ExamInput }): Promise<Exam> => {
      assertReady(mode);
      if (mode === "api") return id ? api.updateExam(id, input) : api.createExam(input);
      const d = demo.current;
      const exam: Exam = { ...input, id: id ?? `exam-${Date.now()}` };
      setDemo({
        ...d,
        exams: id ? d.exams.map((e) => (e.id === id ? exam : e)) : [exam, ...d.exams],
      });
      return exam;
    },
    ...invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      assertReady(mode);
      if (mode === "api") return api.deleteExam(id);
      const d = demo.current;
      const exams = d.exams.filter((e) => e.id !== id),
        schedules = d.schedules.filter((s) => s.exam_id !== id),
        unassigned = d.unassigned.filter((u) => u.exam_id !== id);
      const removed = d.exams.find((e) => e.id === id);
      const students = d.students.map((s) => ({
        ...s,
        enrollments: s.enrollments.filter((code) => code !== removed?.course_code),
      }));
      setDemo({
        ...d,
        exams,
        schedules,
        unassigned,
        students,
        metrics: {
          ...d.metrics,
          total_exams: exams.length,
          scheduled: schedules.length,
          unassigned: unassigned.length,
          conflicts: schedules.filter((s) => s.status === "conflict").length,
        },
        validation: {
          ...d.validation,
          checks: d.validation.checks.map((c) => {
            const details = c.details.filter((detail) => detail.entity_id !== id);
            return { ...c, details, violations: details.length };
          }),
        },
      });
    },
    ...invalidate,
  });
  return { save, remove };
}
