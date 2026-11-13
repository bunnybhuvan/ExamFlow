import { AppActionsContext } from "./app-actions-context";
import { useState, type ReactNode } from "react";
import { GenerateScheduleDialog } from "./generate-schedule-dialog";
import { GenerateDatasetDialog } from "./generate-dataset-dialog";

export function AppActionsProvider({ children }: { children: ReactNode }) {
  const [schedule, setSchedule] = useState(false);
  const [dataset, setDataset] = useState(false);
  return (
    <AppActionsContext.Provider
      value={{ openSchedule: () => setSchedule(true), openDataset: () => setDataset(true) }}
    >
      {children}
      <GenerateScheduleDialog open={schedule} onOpenChange={setSchedule} />
      <GenerateDatasetDialog open={dataset} onOpenChange={setDataset} />
    </AppActionsContext.Provider>
  );
}