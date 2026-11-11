import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, Chips, Meter } from "@/components/app/primitives";
import { DataTable, type Column } from "@/components/app/data-table";
import { useInvigilators } from "@/lib/data-source";
import { fmtDate } from "@/lib/format";
import type { Invigilator } from "@/lib/types";

export const Route = createFileRoute("/invigilators")({
  head: () => ({ meta: [
    { title: "Invigilators — ExamFlow" }, { name: "description", content: "Invigilator availability, qualifications and duty load." },
    { property: "og:title", content: "Invigilators — ExamFlow" }, { property: "og:description", content: "Invigilator availability, qualifications and duty load." },
  ] }),
  component: InvigilatorsPage,
});

function InvigilatorsPage() {
  const inv = useInvigilators();
  const cols: Column<Invigilator>[] = [
    { id: "name", header: "Invigilator", cell: (v) => <div><div className="font-medium">{v.name}</div><div className="text-xs text-muted-foreground">{v.department}</div></div>, sortValue: (v) => v.name },
    { id: "q", header: "Qualifications", cell: (v) => <Chips items={v.qualifications} />, className: "hidden lg:table-cell" },
    { id: "avail", header: "Availability", cell: (v) => (
      <Tooltip><TooltipTrigger asChild><span className="cursor-help text-sm underline decoration-dotted underline-offset-4">{v.available_days.length} days</span></TooltipTrigger>
        <TooltipContent className="max-w-xs">{v.available_days.map(fmtDate).join(", ") || "No availability"}</TooltipContent></Tooltip>
    ), sortValue: (v) => v.available_days.length },
    { id: "duty", header: "Duties", cell: (v) => <div className="w-32"><div className="mb-1 text-xs tabular-nums">{v.assigned_duties} / {v.max_duties}</div><Meter value={v.max_duties ? v.assigned_duties / v.max_duties : 0} /></div>, sortValue: (v) => v.assigned_duties },
    { id: "conf", header: "Conflicts", cell: (v) => v.conflicts ? <Badge variant="danger" className="gap-1"><AlertTriangle className="size-3" />{v.conflicts}</Badge> : <Badge variant="success">0</Badge>, sortValue: (v) => v.conflicts },
  ];
  return (
    <div className="page-enter">
      <PageHeader title="Invigilators" description="Staff supervising exams — availability, qualifications and workload balance." />
      <DataTable data={inv.data} loading={inv.isPending} error={inv.error} onRetry={() => inv.refetch()} columns={cols} rowKey={(v) => v.id}
        searchText={(v) => `${v.name} ${v.department} ${v.qualifications.join(" ")}`} searchPlaceholder="Search staff or qualification…" />
    </div>
  );
}