import { createContext, useContext, useState, type ReactNode } from "react";
import { GenerateScheduleDialog } from "./generate-schedule-dialog";
import { GenerateDatasetDialog } from "./generate-dataset-dialog";

const Ctx = createContext<{ openSchedule: () => void; openDataset: () => void } | null>(null);

export function AppActionsProvider({ children }: { children: ReactNode }) {
  const [schedule, setSchedule] = useState(false);
  const [dataset, setDataset] = useState(false);
  return (
    <Ctx.Provider value={{ openSchedule: () => setSchedule(true), openDataset: () => setDataset(true) }}>
      {children}
      <GenerateScheduleDialog open={schedule} onOpenChange={setSchedule} />
      <GenerateDatasetDialog open={dataset} onOpenChange={setDataset} />
    </Ctx.Provider>
  );
}
export function useAppActions() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppActions outside provider");
  return c;
}