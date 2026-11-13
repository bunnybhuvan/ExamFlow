import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StatusBadge, Chips } from "@/components/app/primitives";
import { DataTable, type Column } from "@/components/app/data-table";
import { ExamFormDialog } from "@/components/app/exam-form-dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useExamMutations, useExams } from "@/lib/data-source";
import { ApiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { Exam } from "@/lib/types";

export const Route = createFileRoute("/exams")({
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s.q === "string" ? { q: s.q } : {},
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Exams — ExamFlow" },
      { name: "description", content: "Manage exams, durations, windows and requirements." },
      { property: "og:title", content: "Exams — ExamFlow" },
      { property: "og:description", content: "Manage exams, durations, windows and requirements." },
    ],
  }),
  component: ExamsPage,
});

function ExamsPage() {
  const { q } = Route.useSearch();
  const exams = useExams();
  const { save, remove } = useExamMutations();
  const [status, setStatus] = useState("all");
  const [dept, setDept] = useState("all");
  const [editing, setEditing] = useState<Exam | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Exam | null>(null);
  const depts = Array.from(new Set((exams.data ?? []).map((e) => e.department))).sort();

  const fail = (what: string) => (e: Error) =>
    toast.error(`Couldn't ${what}`, {
      description: e.message,
    });

  const cols: Column<Exam>[] = [
    {
      id: "code",
      header: "Course",
      cell: (e) => (
        <div>
          <div className="font-mono text-xs font-semibold text-cyan">{e.course_code}</div>
          <div className="font-medium">{e.course_name}</div>
        </div>
      ),
      sortValue: (e) => e.course_code,
    },
    {
      id: "dept",
      header: "Department",
      cell: (e) => e.department,
      sortValue: (e) => e.department,
      className: "hidden lg:table-cell",
    },
    {
      id: "dur",
      header: "Duration",
      cell: (e) => `${e.duration_minutes} min`,
      sortValue: (e) => e.duration_minutes,
    },
    {
      id: "enr",
      header: "Enrolled",
      cell: (e) => <span className="tabular-nums">{e.enrollment}</span>,
      sortValue: (e) => e.enrollment,
    },
    {
      id: "win",
      header: "Window",
      cell: (e) => (
        <span className="text-xs">
          {fmtDate(e.window_start)} → {fmtDate(e.window_end)}
        </span>
      ),
      sortValue: (e) => e.window_start,
      className: "hidden md:table-cell",
    },
    {
      id: "req",
      header: "Requirements",
      cell: (e) => <Chips items={[...e.required_equipment, ...e.accommodations]} />,
      className: "hidden xl:table-cell",
    },
    {
      id: "status",
      header: "Status",
      cell: (e) => <StatusBadge status={e.status} />,
      sortValue: (e) => e.status,
    },
  ];

  return (
    <div className="page-enter">
      <PageHeader
        title="Exams"
        description="Course examinations and their scheduling constraints."
        actions={
          <Button variant="brand" onClick={() => setEditing(null)}>
            <Plus /> New exam
          </Button>
        }
      />
      <DataTable
        key={q}
        data={exams.data}
        loading={exams.isPending}
        error={exams.error}
        onRetry={() => exams.refetch()}
        columns={cols}
        rowKey={(e) => e.id}
        searchText={(e) => `${e.course_code} ${e.course_name} ${e.department}`}
        searchPlaceholder={q ? q : "Search exams…"}
        filter={(e) =>
          (status === "all" || e.status === status) &&
          (dept === "all" || e.department === dept) &&
          (!q || e.course_code === q)
        }
        toolbar={
          <>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-36" aria-label="Filter status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["draft", "pending", "scheduled", "unassigned", "conflict"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-44" aria-label="Filter department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {depts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {q && (
              <Button size="sm" variant="ghost" asChild>
                <Link to="/exams" search={{}}>
                  Clear “{q}”
                </Link>
              </Button>
            )}
          </>
        }
        onRowClick={(e) => setEditing(e)}
        rowActions={(e) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`Actions for ${e.course_code}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(e)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDeleting(e)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyTitle="No exams yet"
        emptyDescription="Create an exam or generate a synthetic dataset."
      />
      <ExamFormDialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && setEditing(undefined)}
        exam={editing}
        saving={save.isPending}
        onSubmit={(input) =>
          save.mutate(
            { id: editing?.id, input },
            {
              onSuccess: (x) => {
                toast.success(editing ? `Updated ${x.course_code}` : `Created ${x.course_code}`);
                setEditing(undefined);
              },
              onError: fail(editing ? "update exam" : "create exam"),
            },
          )
        }
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.course_code}?`}
        description="This removes the exam and any schedule assignment for it. This action is recorded in the audit trail."
        confirmLabel="Delete exam"
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`Deleted ${deleting.course_code}`);
              setDeleting(null);
            },
            onError: fail("delete exam"),
          })
        }
      />
    </div>
  );
}
