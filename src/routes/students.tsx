import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Accessibility, Mail } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  Chips,
  StatusBadge,
  ErrorState,
  LoadingBlock,
} from "@/components/app/primitives";
import { DataTable, type Column } from "@/components/app/data-table";
import { useExams, useSchedules, useStudents } from "@/lib/data-source";
import { fmtDate, fmtTime } from "@/lib/format";
import type { Student } from "@/lib/types";

export const Route = createFileRoute("/students")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s.id === "string" ? { id: s.id } : {},
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Students — ExamFlow" },
      { name: "description", content: "Student enrollments and accommodations." },
      { property: "og:title", content: "Students — ExamFlow" },
      { property: "og:description", content: "Student enrollments and accommodations." },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const { id } = Route.useSearch();
  const students = useStudents();
  const [onlyAcc, setOnlyAcc] = useState(false);
  const navigate = useNavigate({ from: "/students" });
  const setSelId = (value: string | null) => navigate({ search: value ? { id: value } : {} });
  const sel = students.data?.find((s) => s.id === id) ?? null;
  const cols: Column<Student>[] = [
    {
      id: "name",
      header: "Student",
      cell: (s) => (
        <div>
          <div className="font-medium">{s.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{s.id}</div>
        </div>
      ),
      sortValue: (s) => s.name,
    },
    {
      id: "prog",
      header: "Program",
      cell: (s) => s.program,
      sortValue: (s) => s.program,
      className: "hidden md:table-cell",
    },
    { id: "year", header: "Year", cell: (s) => s.year, sortValue: (s) => s.year },
    {
      id: "enr",
      header: "Enrollments",
      cell: (s) => <span className="tabular-nums">{s.enrollments.length}</span>,
      sortValue: (s) => s.enrollments.length,
    },
    {
      id: "acc",
      header: "Accommodations",
      cell: (s) =>
        s.accommodations.length ? (
          <Badge variant="brand" className="gap-1">
            <Accessibility className="size-3" />
            {s.accommodations.join(", ")}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];
  return (
    <div className="page-enter">
      <PageHeader
        title="Students"
        description="Enrollments drive clash detection; accommodations drive room and timing rules."
      />
      <DataTable
        data={students.data}
        loading={students.isPending}
        error={students.error}
        onRetry={() => students.refetch()}
        columns={cols}
        rowKey={(s) => s.id}
        searchText={(s) => `${s.name} ${s.id} ${s.email} ${s.enrollments.join(" ")}`}
        searchPlaceholder="Search name, ID, course…"
        filter={(s) => !onlyAcc || s.accommodations.length > 0}
        onRowClick={(s) => setSelId(s.id)}
        toolbar={
          <div className="flex items-center gap-2">
            <Switch id="acc" checked={onlyAcc} onCheckedChange={setOnlyAcc} />
            <Label htmlFor="acc" className="text-sm">
              With accommodations
            </Label>
          </div>
        }
      />
      <StudentDrawer s={sel} onClose={() => setSelId(null)} />
    </div>
  );
}

function StudentDrawer({ s, onClose }: { s: Student | null; onClose: () => void }) {
  const examsQuery = useExams(),
    schedQuery = useSchedules();
  const exams = examsQuery.data ?? [];
  const sched = schedQuery.data ?? [];
  return (
    <Sheet open={!!s} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {s && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display">{s.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {s.email}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5 px-4 text-sm">
              {examsQuery.error || schedQuery.error ? (
                <ErrorState
                  error={examsQuery.error || schedQuery.error}
                  onRetry={() => {
                    examsQuery.refetch();
                    schedQuery.refetch();
                  }}
                />
              ) : (
                (examsQuery.isPending || schedQuery.isPending) && <LoadingBlock rows={2} />
              )}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["ID", s.id],
                  ["Program", s.program],
                  ["Year", s.year],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-border bg-muted/40 p-2">
                    <div className="truncate text-xs font-medium">{v}</div>
                    <div className="text-[11px] text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  Accommodations
                </div>
                <Chips items={s.accommodations} empty="None on file" />
              </div>
              <div>
                <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  Course enrollments & exams
                </div>
                <ul className="space-y-2">
                  {s.enrollments.map((code) => {
                    const ex = exams.find((e) => e.course_code === code);
                    const a = ex && sched.find((x) => x.exam_id === ex.id);
                    return (
                      <li key={code} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-cyan">{code}</span>
                          {ex && <StatusBadge status={ex.status} />}
                        </div>
                        <div className="mt-0.5">{ex?.course_name ?? "Unknown course"}</div>
                        {a && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {fmtDate(a.start)} · {fmtTime(a.start)} · {a.room_name}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}