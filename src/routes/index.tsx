import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CalendarCheck, CircleDashed, DoorOpen, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, Panel, ErrorState, EmptyState, SeverityBadge, LoadingBlock } from "@/components/app/primitives";
import { CoverageChart } from "@/components/charts/charts";
import { useAppActions } from "@/components/app/app-actions";
import { useAudit, useMetrics, useSchedules, useUnassigned, useValidation } from "@/lib/data-source";
import { deriveConflicts } from "@/lib/conflicts";
import { fmtDate, fmtDateTime, fmtTime, pct, titleCase } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — ExamFlow" },
      { name: "description", content: "Exam scheduling KPIs, coverage, weekly timeline and unresolved issues." },
      { property: "og:title", content: "Overview — ExamFlow" },
      { property: "og:description", content: "Exam scheduling KPIs, coverage, weekly timeline and unresolved issues." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const metrics = useMetrics();
  const schedules = useSchedules();
  const audit = useAudit();
  const validation = useValidation();
  const unassigned = useUnassigned();
  const { openSchedule } = useAppActions();
  const m = metrics.data;
  const issues = deriveConflicts(validation.data, unassigned.data);

  const days = Array.from(new Set((schedules.data ?? []).map((s) => s.start.slice(0, 10)))).sort().slice(0, 5);

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan">Winter examination session</p>
          <h1 className="mt-1 text-3xl font-semibold">Operations overview</h1>
        </div>
        <Button variant="brand" onClick={openSchedule}><Sparkles /> Generate Schedule</Button>
      </div>

      {metrics.error ? <ErrorState error={metrics.error} onRetry={() => metrics.refetch()} /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="Total exams" value={m?.total_exams ?? 0} icon={FileText} loading={!m} />
          <KpiCard label="Scheduled" value={m?.scheduled ?? 0} icon={CalendarCheck} tone="success" loading={!m} hint={m ? `${pct(m.total_exams ? m.scheduled / m.total_exams : 0)} coverage` : undefined} />
          <KpiCard label="Unassigned" value={m?.unassigned ?? 0} icon={CircleDashed} tone="warning" loading={!m} />
          <KpiCard label="Conflicts" value={m?.conflicts ?? 0} icon={AlertTriangle} tone="danger" loading={!m} />
          <KpiCard label="Room utilization" value={(m?.room_utilization ?? 0) * 100} format={(n) => `${Math.round(n)}%`} icon={DoorOpen} tone="info" loading={!m} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Schedule coverage" description="Exams placed per exam day" className="xl:col-span-2">
          {!m ? <Skeleton className="h-60 w-full" /> : m.coverage_by_day.length === 0 ? <EmptyState title="No schedule yet" description="Generate a schedule to see coverage." /> :
            <CoverageChart data={m.coverage_by_day.map((d) => ({ ...d, label: fmtDate(d.date) }))} />}
        </Panel>
        <Panel title="Unresolved issues" description={`${issues.length} open`} actions={<Link to="/conflicts" className="text-xs text-primary hover:underline">View all</Link>} bodyClassName="p-0">
          {validation.isPending ? <div className="p-5"><LoadingBlock rows={4} /></div> : issues.length === 0 ? <EmptyState title="No open issues" /> : (
            <ul className="max-h-[260px] divide-y divide-border overflow-auto">
              {issues.slice(0, 8).map((c) => (
                <li key={c.id} className="px-5 py-3 transition-colors hover:bg-accent/40">
                  <div className="flex items-center gap-2"><SeverityBadge severity={c.severity} /><span className="text-xs text-muted-foreground">{c.category}</span></div>
                  <p className="mt-1 line-clamp-1 text-sm">{c.title}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Weekly exam timeline" description="First five exam days" className="xl:col-span-2" actions={<Link to="/schedule" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Open schedule <ArrowRight className="size-3" /></Link>}>
          {schedules.isPending ? <LoadingBlock rows={5} /> : schedules.error ? <ErrorState error={schedules.error} onRetry={() => schedules.refetch()} /> : days.length === 0 ? <EmptyState title="Nothing scheduled" /> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              {days.map((d) => {
                const items = schedules.data!.filter((s) => s.start.startsWith(d)).sort((a, b) => a.start.localeCompare(b.start));
                return (
                  <div key={d} className="min-w-0">
                    <div className="mb-2 flex items-baseline justify-between text-xs"><span className="font-semibold">{fmtDate(d)}</span><span className="text-muted-foreground">{items.length}</span></div>
                    <div className="space-y-1.5">
                      {items.slice(0, 6).map((s) => (
                        <div key={s.id} className={`rounded-md border-l-2 bg-muted/50 px-2 py-1.5 text-xs ${s.status === "conflict" ? "border-destructive" : "border-primary"}`}>
                          <div className="font-mono text-[10px] text-muted-foreground">{fmtTime(s.start)}</div>
                          <div className="truncate font-medium">{s.course_code}</div>
                        </div>
                      ))}
                      {items.length > 6 && <div className="text-[11px] text-muted-foreground">+{items.length - 6} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="Recent audit events" actions={<Link to="/audit" className="text-xs text-primary hover:underline">Audit trail</Link>} bodyClassName="p-0">
          {audit.isPending ? <div className="p-5"><LoadingBlock rows={5} /></div> : audit.error ? <div className="p-5"><ErrorState error={audit.error} /></div> : (
            <ol className="max-h-[300px] divide-y divide-border overflow-auto">
              {(audit.data ?? []).slice(0, 7).map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-mono text-cyan">{e.action}</span><span className="text-muted-foreground">{fmtDateTime(e.timestamp)}</span></div>
                  <p className="mt-0.5 line-clamp-1 text-sm">{e.summary}</p>
                  <p className="text-xs text-muted-foreground">{titleCase(e.entity_type)} · {e.actor}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}