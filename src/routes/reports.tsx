import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Braces,
  FileSpreadsheet,
  Loader2,
  FileText,
  CalendarCheck,
  DoorOpen,
  Users,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, KpiCard, ErrorState } from "@/components/app/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverageChart, HBarChart } from "@/components/charts/charts";
import { useDataSource, useMetrics, useExportSchedule } from "@/lib/data-source";
import { downloadBlob } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { ExportFormat, ScheduleAssignment } from "@/lib/types";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Reports & Exports — ExamFlow" },
      {
        name: "description",
        content: "Scheduling metrics, utilization, workload and CSV, JSON and SQL database exports.",
      },
      { property: "og:title", content: "Reports & Exports — ExamFlow" },
      {
        property: "og:description",
        content: "Scheduling metrics, utilization, workload and CSV, JSON and SQL database exports.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { mode } = useDataSource();
  const m = useMetrics();
  const exporter = useExportSchedule();
  const busy = exporter.isPending ? exporter.variables : null;
  const doExport = async (f: ExportFormat) => {
    try {
      const { blob, filename, demo } = await exporter.mutateAsync(f);
      downloadBlob(blob, filename);
      if (!demo) {
        toast.success(`Downloaded ${filename}`);
      } else {
        toast.warning(`Downloaded ${filename}`, {
          description: "Demo Mode: exported the local demo fixture, not backend data.",
        });
      }
    } catch (e) {
      toast.error(`Export ${f.toUpperCase()} failed`, { description: (e as Error).message });
    }
  };
  const d = m.data;
  return (
    <div className="page-enter space-y-6">
      <PageHeader
        title="Reports & Exports"
        description="Session metrics and downloadable schedule and database exports."
        actions={
          <>
            <Button
              variant="subtle"
              onClick={() => doExport("csv")}
              disabled={!!busy || mode === "checking"}
            >
              {busy === "csv" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Export
              CSV
            </Button>
            <Button
              variant="subtle"
              onClick={() => doExport("json")}
              disabled={!!busy || mode === "checking"}
            >
              {busy === "json" ? <Loader2 className="animate-spin" /> : <Braces />} Export JSON
            </Button>
            {mode === "api" && (
              <Button variant="subtle" onClick={() => doExport("sql")} disabled={!!busy}>
                {busy === "sql" ? <Loader2 className="animate-spin" /> : <Database />} Export SQL
              </Button>
            )}
          </>
        }
      />
      {m.error ? (
        <ErrorState error={m.error} onRetry={() => m.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total exams" value={d?.total_exams ?? 0} icon={FileText} loading={!d} />
            <KpiCard
              label="Coverage"
              value={d && d.total_exams ? (d.scheduled / d.total_exams) * 100 : 0}
              format={(n) => `${Math.round(n)}%`}
              icon={CalendarCheck}
              tone="success"
              loading={!d}
            />
            <KpiCard
              label="Avg room utilization"
              value={(d?.room_utilization ?? 0) * 100}
              format={(n) => `${Math.round(n)}%`}
              icon={DoorOpen}
              tone="info"
              loading={!d}
            />
            <KpiCard
              label="Avg duties / invigilator"
              value={
                d && d.invigilator_workload.length
                  ? d.invigilator_workload.reduce((a, b) => a + b.duties, 0) /
                    d.invigilator_workload.length
                  : 0
              }
              format={(n) => n.toFixed(1)}
              icon={Users}
              tone="brand"
              loading={!d}
            />
          </div>
          <Panel title="Schedule coverage">
            {d ? (
              <CoverageChart
                data={d.coverage_by_day.map((x) => ({ ...x, label: fmtDate(x.date) }))}
                height={260}
              />
            ) : (
              <Skeleton className="h-64" />
            )}
          </Panel>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Room utilization">
              {d ? (
                <HBarChart
                  data={[...d.room_usage]
                    .sort((a, b) => b.utilization - a.utilization)
                    .slice(0, 12)}
                  dataKey="utilization"
                  nameKey="room"
                  percent
                  height={320}
                />
              ) : (
                <Skeleton className="h-80" />
              )}
            </Panel>
            <Panel title="Invigilator workload" description="Assigned duties">
              {d ? (
                <HBarChart
                  data={[...d.invigilator_workload]
                    .sort((a, b) => b.duties - a.duties)
                    .slice(0, 12)}
                  dataKey="duties"
                  nameKey="name"
                  color="var(--chart-1)"
                  height={320}
                />
              ) : (
                <Skeleton className="h-80" />
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
