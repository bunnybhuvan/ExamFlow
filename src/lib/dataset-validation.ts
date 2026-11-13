import { DEMO_SEED } from "./demo";
import type { GenerateDatasetParams } from "./types";

export const PRESETS: {
  label: string;
  p: Omit<GenerateDatasetParams, "seed" | "include_edge_cases">;
}[] = [
  { label: "Small", p: { students: 500, exams: 60, rooms: 15, invigilators: 30 } },
  { label: "Faculty", p: { students: 5000, exams: 300, rooms: 100, invigilators: 200 } },
  { label: "University", p: { students: 25000, exams: 1800, rooms: 220, invigilators: 600 } },
];

export const DEFAULT_DATASET_PARAMS: GenerateDatasetParams = {
  ...PRESETS[1].p,
  seed: DEMO_SEED,
  include_edge_cases: false,
};
export function isDatasetInvalid(p: GenerateDatasetParams) {
  return (
    [p.students, p.exams, p.rooms, p.invigilators, p.seed].some(
      (v) => !Number.isSafeInteger(v) || v < 0,
    ) ||
    p.exams < 1 ||
    p.rooms < 1
  );
}
