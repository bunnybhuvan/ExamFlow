import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Braces, FileSpreadsheet, Loader2, FileText, CalendarCheck, DoorOpen, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, KpiCard, ErrorState } from "@/components/app/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverageChart, HBarChart } from "@/components/charts/charts";
import { useDataSource, useMetrics, useSchedules } from "@/lib/data-source";
import { api, downloadBlob } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { ExportFormat, ScheduleAssignment } from "@/lib/types";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [
    { title: "Reports & Exports — ExamFlow" }, { name: "description", content: "Scheduling metrics, utilization, workload and CSV/JSON exports." },
    { property: "og:title", content: "Reports & Exports — ExamFlow" }, { property: "og:description", content: "Scheduling metrics, utilization, workload and CSV/JSON exports." },
  ] }),
  component: ReportsPage,
});

function toCsv(rows: ScheduleAssignment[]) {
  const head = ["id", "exam_id", "course_code", "course_name", "room_name", "start", "end", "enrolled", "capacity", "status", "invigilators"];
  const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  return [head.join(","), ...rows.map((r) => [r.id, r.exam_id, r.course_code, r.course_name, r.room_name, r.start, r.end, r.enrolled, r.capacity, r.status, r.invigilator_ids.join(";")].map(esc).join(","))].join("\n");
}

function ReportsPage() {
  const { mode } = useDataSource();
  const m = useMetrics();
  const sched = useSchedules();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const doExport = async (f: ExportFormat) => {
    setBusy(f);
    try {
      if (mode === "api") {
        const { blob, filename } = await api.exportFile(f);
        downloadBlob(blob, filename);
        toast.success(`Downloaded ${filename}`);
      } else {
        const rows = sched.data ?? [];
        const body = f === "csv" ? toCsv(rows) : JSON.stringify({ demo: true, note: "DEMO FIXTURE — not backend data", assignments: rows }, null, 2);
        const name = `examflow-DEMO-schedule.${f}`;
        downloadBlob(new Blob([body], { type: f === "csv" ? "text/csv" : "application/json" }), name);
        toast.warning(`Downloaded ${name}`, { description: "Demo Mode: exported the local demo fixture, not backend data." });
      }
    } catch (e) {
      toast.error(`Export ${f.toUpperCase()} failed`, { description: (e as Error).message });
    } finally { setBusy(null); }
  };
  const d = m.data;
  return (
    <div className="page-enter space-y-6">
      <PageHeader title="Reports & Exports" description="Session metrics and downloadable schedule exports."
        actions={<>
          <Button variant="subtle" onClick={() => doExport("csv")} disabled={!!busy || mode === "checking"}>{busy === "csv" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Export CSV</Button>
          <Button variant="subtle" onClick={() => doExport("json")} disabled={!!busy || mode === "checking"}>{busy === "json" ? <Loader2 className="animate-spin" /> : <Braces />} Export JSON</Button>
        </>} />
      {m.error ? <ErrorState error={m.error} onRetry={() => m.refetch()} /> : (<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total exams" value={d?.total_exams ?? 0} icon={FileText} loading={!d} />
          <KpiCard label="Coverage" value={d && d.total_exams ? (d.scheduled / d.total_exams) * 100 : 0} format={(n) => `${Math.round(n)}%`} icon={CalendarCheck} tone="success" loading={!d} />
          <KpiCard label="Avg room utilization" value={(d?.room_utilization ?? 0) * 100} format={(n) => `${Math.round(n)}%`} icon={DoorOpen} tone="info" loading={!d} />
          <KpiCard label="Avg duties / invigilator" value={d && d.invigilator_workload.length ? d.invigilator_workload.reduce((a, b) => a + b.duties, 0) / d.invigilator_workload.length : 0} format={(n) => n.toFixed(1)} icon={Users} tone="brand" loading={!d} />
        </div>
        <Panel title="Schedule coverage">{d ? <CoverageChart data={d.coverage_by_day.map((x) => ({ ...x, label: fmtDate(x.date) }))} height={260} /> : <Skeleton className="h-64" />}</Panel>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Room utilization">{d ? <HBarChart data={[...d.room_usage].sort((a, b) => b.utilization - a.utilization).slice(0, 12)} dataKey="utilization" nameKey="room" percent height={320} /> : <Skeleton className="h-80" />}</Panel>
          <Panel title="Invigilator workload" description="Assigned duties">{d ? <HBarChart data={[...d.invigilator_workload].sort((a, b) => b.duties - a.duties).slice(0, 12)} dataKey="duties" nameKey="name" color="var(--chart-1)" height={320} /> : <Skeleton className="h-80" />}</Panel>
        </div>
      </>)}
    </div>
  );
}