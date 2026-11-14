import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KpiCard, PageHeader, Chips, Meter } from "@/components/app/primitives";
import { DataTable, type Column } from "@/components/app/data-table";
import { useInvigilators } from "@/lib/data-source";
import { fmtDate } from "@/lib/format";
import type { Invigilator } from "@/lib/types";

export const Route = createFileRoute("/invigilators")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Invigilators — ExamFlow" },
      { name: "description", content: "Invigilator availability, qualifications and duty load." },
      { property: "og:title", content: "Invigilators — ExamFlow" },
      {
        property: "og:description",
        content: "Invigilator availability, qualifications and duty load.",
      },
    ],
  }),
  component: InvigilatorsPage,
});

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function InvigilatorsPage() {
  const inv = useInvigilators();
  const staff = inv.data ?? [];
  const assigned = staff.reduce((sum, person) => sum + person.assigned_duties, 0);
  const capacity = staff.reduce((sum, person) => sum + person.max_duties, 0);
  const conflicts = staff.reduce((sum, person) => sum + person.conflicts, 0);
  const averageAvailability = staff.length
    ? Math.round(staff.reduce((sum, person) => sum + person.available_days.length, 0) / staff.length)
    : 0;
  const remaining = Math.max(0, capacity - assigned);

  const cols: Column<Invigilator>[] = [
    {
      id: "name",
      header: "Staff member",
      cell: (v) => (
        <div className="flex min-w-[220px] items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#dce5e2] bg-[#edf2ef] text-[11px] font-semibold tracking-wide text-[#355d6d]">
            {initials(v.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-[#28383e]">{v.name}</span>
            <span className="mt-0.5 block truncate text-xs text-[#849094]">{v.department}</span>
          </span>
        </div>
      ),
      sortValue: (v) => v.name,
    },
    {
      id: "q",
      header: "Qualified for",
      cell: (v) => <Chips items={v.qualifications} />,
      className: "hidden lg:table-cell",
    },
    {
      id: "avail",
      header: "Availability",
      cell: (v) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center gap-2 text-[12px] font-medium text-[#52666c] underline decoration-dotted decoration-[#aab8b5] underline-offset-4">
              <span className="size-1.5 rounded-full bg-[#54866f]" />
              {v.available_days.length} days
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {v.available_days.map(fmtDate).join(", ") || "No availability"}
          </TooltipContent>
        </Tooltip>
      ),
      sortValue: (v) => v.available_days.length,
    },
    {
      id: "duty",
      header: "Duty allocation",
      cell: (v) => {
        const ratio = v.max_duties ? v.assigned_duties / v.max_duties : 0;
        const left = Math.max(0, v.max_duties - v.assigned_duties);
        return (
          <div className="w-36">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-semibold tabular-nums text-[#34464d]">
                {v.assigned_duties}
                <span className="font-normal text-[#9aa5a4]"> / {v.max_duties}</span>
              </span>
              <span className="text-[10px] text-[#8a9695]">{left} left</span>
            </div>
            <Meter value={ratio} className="h-[5px] bg-[#edf0ee]" />
          </div>
        );
      },
      sortValue: (v) => v.assigned_duties,
    },
    {
      id: "conf",
      header: "Conflict check",
      cell: (v) =>
        v.conflicts ? (
          <Badge variant="danger" className="gap-1 rounded-full px-2.5">
            <AlertTriangle className="size-3" />
            {v.conflicts} {v.conflicts === 1 ? "issue" : "issues"}
          </Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#4e806a]">
            <CheckCircle2 className="size-3.5" />
            Clear
          </span>
        ),
      sortValue: (v) => v.conflicts,
    },
  ];

  return (
    <div className="page-enter space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#e0e6e2] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-[#879592]">
            <span className="h-px w-5 bg-[#8da5a0]" />
            PEOPLE & CAPACITY
          </div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.045em] text-[#26373d] sm:text-[34px]">
            Invigilator roster
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#77868a]">
            The people behind every exam session. Review availability, specialist qualifications
            and duty allocation before building the timetable.
          </p>
        </div>
        <div className="flex items-center gap-2 pb-1 text-[11px] text-[#78888a]">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#77a58b] opacity-30" />
            <span className="relative inline-flex size-2 rounded-full bg-[#54866f]" />
          </span>
          Live staff records
        </div>
      </div>

      <section aria-label="Invigilator capacity overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Invigilators"
          value={staff.length}
          icon={Users}
          tone="brand"
          hint="Staff in the current roster"
          loading={inv.isPending}
        />
        <KpiCard
          label="Duty capacity remaining"
          value={remaining}
          icon={ClipboardList}
          tone="success"
          hint={`${assigned} of ${capacity} duties allocated`}
          loading={inv.isPending}
        />
        <KpiCard
          label="Average availability"
          value={averageAvailability}
          icon={CalendarDays}
          tone="info"
          hint="Available days per staff member"
          loading={inv.isPending}
        />
        <KpiCard
          label="Scheduling conflicts"
          value={conflicts}
          icon={AlertTriangle}
          tone={conflicts ? "danger" : "success"}
          hint={conflicts ? "Needs review before assignment" : "No staff conflicts detected"}
          loading={inv.isPending}
        />
      </section>

      <section aria-labelledby="roster-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 id="roster-heading" className="text-[15px] font-semibold tracking-[-0.02em] text-[#2e4147]">
              Staff directory
            </h2>
            <p className="mt-1 text-xs text-[#849094]">
              Individual qualifications and current workload
            </p>
          </div>
          <div className="text-[11px] text-[#8a9695]">
            Workload is measured against each person's duty limit
          </div>
        </div>
        <DataTable
          data={inv.data}
          loading={inv.isPending}
          error={inv.error}
          onRetry={() => inv.refetch()}
          columns={cols}
          rowKey={(v) => v.id}
          searchText={(v) => `${v.name} ${v.department} ${v.email} ${v.qualifications.join(" ")}`}
          searchPlaceholder="Find a person, department or qualification…"
          emptyTitle="No staff match this search"
          emptyDescription="Try another name, department or qualification."
        />
      </section>
    </div>
  );
}
