import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { buildDemoDataset, DEMO_SEED, type DemoDataset } from "./demo";
import { DataSourceContext, type DataMode } from "./data-source-context";

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    retry: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });
  const [initialDemo] = useState(() => buildDemoDataset(DEMO_SEED));
  const demo = useRef<DemoDataset>(initialDemo);
  const [, bump] = useState(0);
  const mode: DataMode = health.isPending ? "checking" : health.isSuccess ? "api" : "demo";
  const setDemo = useCallback(
    (d: DemoDataset) => {
      demo.current = d;
      bump((n) => n + 1);
      qc.invalidateQueries({ queryKey: ["demo"] });
    },
    [qc],
  );
  const value = useMemo<React.ContextType<typeof DataSourceContext>>(
    () => ({
      mode,
      healthError: health.error ? (health.error as Error).message : null,
      retry: () => health.refetch(),
      demo,
      setDemo,
    }),
    [mode, health, setDemo],
  );
  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>;
}
