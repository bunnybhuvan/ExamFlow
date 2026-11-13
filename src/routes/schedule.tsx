import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, List, Users, DoorOpen, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PageHeader,
  Panel,
  StatusBadge,
  ErrorState,
  LoadingBlock,
  EmptyState,
  Meter,
  Chips,
} from "@/components/app/primitives";
import { DataTable, type Column } from "@/components/app/data-table";
import { useExams, useInvigilators, useSchedules, useUnassigned } from "@/lib/data-source";
import { fmtDate, fmtTime } from "@/lib/format";
import type { ScheduleAssignment } from "@/lib/types";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Schedule — ExamFlow" },
      { name: "description", content: "Calendar and table views of exam assignments." },
      { property: "og:title", content: "Schedule — ExamFlow" },
      { property: "og:description", content: "Calendar and table views of exam assignments." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const sched = useSchedules();
  const unassigned = useUnassigned();
  const [day, setDay] = useState("all");
  const [status, setStatus] = useState("all");
  const [room, setRoom] = useState("all");
  const [sel, setSel] = useState<ScheduleAssignment | null>(null);
  const data = useMemo(() => sched.data ?? [], [sched.data]);
  const days = useMemo(
    () => Array.from(new Set(data.map((s) => s.start.slice(0, 10)))).sort(),
    [data],
  );
  const rooms = useMemo(() => Array.from(new Set(data.map((s) => s.room_name))).sort(), [data]);
  const filtered = data.filter(
    (s) =>
      (day === "all" || s.start.startsWith(day)) &&
      (status === "all" || s.status === status) &&
      (room === "all" || s.room_name === room),
  );

  const filters = (
    <>
      <FilterSelect
        label="Date"
        value={day}
        onChange={setDay}
        options={days.map((d) => [d, fmtDate(d)])}
      />
      <FilterSelect
        label="Status"
        value={status}
        onChange={setStatus}
        options={[
          ["confirmed", "Confirmed"],
          ["tentative", "Tentative"],
          ["conflict", "Conflict"],
        ]}
      />
      <FilterSelect
        label="Room"
        value={room}
        onChange={setRoom}
        options={rooms.map((r) => [r, r])}
      />
    </>
  );
  const cols: Column<ScheduleAssignment>[] = [
    {
      id: "course",
      header: "Exam",
      cell: (s) => (
        <div>
          <div className="font-medium">{s.course_code}</div>
          <div className="text-xs text-muted-foreground">{s.course_name}</div>
        </div>
      ),
      sortValue: (s) => s.course_code,
    },
    { id: "date", header: "Date", cell: (s) => fmtDate(s.start), sortValue: (s) => s.start },
    {
      id: "time",
      header: "Time",
      cell: (s) => (
        <span className="font-mono text-xs">
          {fmtTime(s.start)}–{fmtTime(s.end)}
        </span>
      ),
    },
    { id: "room", header: "Room", cell: (s) => s.room_name, sortValue: (s) => s.room_name },
    {
      id: "fill",
      header: "Seats",
      cell: (s) => (
        <div className="w-28">
          <div className="mb-1 text-xs tabular-nums">
            {s.enrolled}/{s.capacity}
          </div>
          <Meter value={s.enrolled / s.capacity} />
        </div>
      ),
      sortValue: (s) => s.enrolled / s.capacity,
    },
    {
      id: "status",
      header: "Status",
      cell: (s) => <StatusBadge status={s.status} />,
      sortValue: (s) => s.status,
    },
  ];

  return (
    <div className="page-enter">
      <PageHeader
        title="Schedule"
        description={`${data.length} assignments${unassigned.data ? ` · ${unassigned.data.length} unassigned` : ""}`}
      />
      {unassigned.error && (
        <ErrorState error={unassigned.error} onRetry={() => unassigned.refetch()} />
      )}
      <Tabs defaultValue="calendar">
        <TabsList className="mb-4">
          <TabsTrigger value="calendar">
            <CalendarDays className="mr-1.5 size-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="table">
            <List className="mr-1.5 size-4" />
            Table
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
          <div className="mb-3 flex flex-wrap gap-2">{filters}</div>
          {sched.error ? (
            <ErrorState error={sched.error} onRetry={() => sched.refetch()} />
          ) : sched.isPending ? (
            <LoadingBlock rows={8} />
          ) : filtered.length === 0 ? (
            <Panel>
              <EmptyState
                title="No assignments match"
                description="Adjust filters or generate a schedule."
              />
            </Panel>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div
                className="grid min-w-[900px] gap-3"
                style={{
                  gridTemplateColumns: `repeat(${(day === "all" ? days : [day]).length}, minmax(170px, 1fr))`,
                }}
              >
                {(day === "all" ? days : [day]).map((d) => {
                  const items = filtered
                    .filter((s) => s.start.startsWith(d))
                    .sort((a, b) => a.start.localeCompare(b.start));
                  return (
                    <div key={d} className="glass rounded-xl p-2">
                      <div className="mb-2 flex items-center justify-between px-1 text-xs">
                        <span className="font-semibold">{fmtDate(d)}</span>
                        <span className="text-muted-foreground">{items.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {items.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSel(s)}
                            className={`block w-full rounded-lg border-l-2 bg-muted/50 px-2.5 py-2 text-left text-xs transition-all hover:-translate-y-px hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${s.status === "conflict" ? "border-destructive" : s.status === "tentative" ? "border-info" : "border-primary"}`}
                          >
                            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                              <span>
                                {fmtTime(s.start)}–{fmtTime(s.end)}
                              </span>
                            </div>
                            <div className="mt-0.5 font-semibold">{s.course_code}</div>
                            <div className="truncate text-muted-foreground">
                              {s.room_name} · {s.enrolled} seats
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="table">
          <DataTable
            data={sched.data && filtered}
            loading={sched.isPending}
            error={sched.error}
            onRetry={() => sched.refetch()}
            columns={cols}
            rowKey={(s) => s.id}
            searchText={(s) => `${s.course_code} ${s.course_name} ${s.room_name}`}
            toolbar={filters}
            onRowClick={setSel}
            emptyTitle="No assignments"
          />
        </TabsContent>
      </Tabs>
      <AssignmentDrawer a={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-40" aria-label={`Filter by ${label}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          {label === "Status" ? "All statuses" : `All ${label.toLowerCase()}s`}
        </SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AssignmentDrawer({ a, onClose }: { a: ScheduleAssignment | null; onClose: () => void }) {
  const examsQuery = useExams(),
    invsQuery = useInvigilators();
  const exams = examsQuery.data;
  const invs = invsQuery.data;
  const exam = exams?.find((e) => e.id === a?.exam_id);
  return (
    <Sheet open={!!a} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {a && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display">{a.course_code}</SheetTitle>
              <SheetDescription>{a.course_name}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5 px-4 text-sm">
              {examsQuery.error || invsQuery.error ? (
                <ErrorState
                  error={examsQuery.error || invsQuery.error}
                  onRetry={() => {
                    examsQuery.refetch();
                    invsQuery.refetch();
                  }}
                />
              ) : (
                (examsQuery.isPending || invsQuery.isPending) && <LoadingBlock rows={2} />
              )}
              <StatusBadge status={a.status} />
              <Row icon={Clock} label="When">
                {fmtDate(a.start)} · {fmtTime(a.start)}–{fmtTime(a.end)}
              </Row>
              <Row icon={DoorOpen} label="Room">
                {a.room_name}
                <div className="mt-2">
                  <Meter value={a.enrolled / a.capacity} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {a.enrolled} of {a.capacity} seats
                </div>
              </Row>
              <Row icon={Users} label="Invigilators">
                <ul className="space-y-1">
                  {a.invigilator_ids.map((id) => (
                    <li key={id}>{invs?.find((v) => v.id === id)?.name ?? id}</li>
                  ))}
                </ul>
              </Row>
              {exam && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <span>{exam.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{exam.duration_minutes} min</span>
                  </div>
                  <div>
                    <div className="mb-1 text-muted-foreground">Equipment</div>
                    <Chips items={exam.required_equipment} empty="None" />
                  </div>
                  <div>
                    <div className="mb-1 text-muted-foreground">Accommodations</div>
                    <Chips items={exam.accommodations} empty="None" />
                  </div>
                </div>
              )}
              <p className="font-mono text-xs text-muted-foreground">
                assignment {a.id} · exam {a.exam_id}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}