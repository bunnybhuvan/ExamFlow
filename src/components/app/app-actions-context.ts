import { createContext, useContext } from "react";

export const AppActionsContext = createContext<{
  openSchedule: () => void;
  openDataset: () => void;
} | null>(null);

export function useAppActions() {
  const c = useContext(AppActionsContext);
  if (!c) throw new Error("useAppActions outside provider");
  return c;
}
