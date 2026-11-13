import { FlaskConical, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data-source";
import { API_BASE_URL } from "@/lib/api";

export function DemoBanner() {
  const { mode, healthError, retry } = useDataSource();
  if (mode !== "demo") return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning md:px-6"
    >
      <FlaskConical className="size-4 shrink-0" />
      <span className="font-semibold">Demo Mode</span>
      <span className="text-warning/90">
        Backend unreachable at <code className="font-mono text-xs">{API_BASE_URL}</code>
        {healthError && !healthError.startsWith("Cannot reach") ? ` (${healthError})` : ""}. Showing
        a deterministic local demo fixture — not real data.
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={retry}
        className="ml-auto h-7 text-warning hover:bg-warning/15 hover:text-warning"
      >
        <RefreshCw /> Retry connection
      </Button>
    </div>
  );
}