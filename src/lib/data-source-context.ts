import { createContext } from "react";
import type { DemoDataset } from "./demo";

export type DataMode = "checking" | "api" | "demo";

interface Ctx {
  mode: DataMode;
  healthError: string | null;
  retry: () => void;
  demo: React.MutableRefObject<DemoDataset>;
  setDemo: (d: DemoDataset) => void;
}
export const DataSourceContext = createContext<Ctx | null>(null);