import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { examSchema } from "@/lib/exam-validation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Exam, ExamInput } from "@/lib/types";

type FormIn = z.input<typeof examSchema>;

export function ExamFormDialog({
  open,
  onOpenChange,
  exam,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exam?: Exam | null;
  onSubmit: (v: ExamInput) => void;
  saving: boolean;
}) {
  const f = useForm<FormIn, unknown, ExamInput>({ resolver: zodResolver(examSchema) });
  useEffect(() => {
    if (!open) return;
    f.reset(
      exam
        ? {
            ...exam,
            required_equipment: exam.required_equipment.join(", "),
            accommodations: exam.accommodations.join(", "),
          }
        : {
            course_code: "",
            course_name: "",
            department: "",
            duration_minutes: 120,
            enrollment: 50,
            window_start: "2026-12-07",
            window_end: "2026-12-18",
            required_equipment: "",
            accommodations: "",
            status: "pending",
          },
    );
  }, [open, exam, f]);
  const err = f.formState.errors;
  const field = (
    name: keyof FormIn,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ex-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={`ex-${name}`} aria-invalid={!!err[name]} {...f.register(name)} {...props} />
      {err[name] && <p className="text-xs text-destructive">{String(err[name]?.message)}</p>}
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{exam ? `Edit ${exam.course_code}` : "New exam"}</DialogTitle>
          <DialogDescription>
            Define the exam's constraints. The solver respects the date window, capacity, equipment
            and accommodations.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={f.handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          noValidate
        >
          {field("course_code", "Course code", {
            placeholder: "CS101",
            className: "font-mono uppercase",
          })}
          {field("course_name", "Course name")}
          {field("department", "Department")}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={f.watch("status")}
              onValueChange={(v) => f.setValue("status", v as ExamInput["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["draft", "pending", "scheduled", "unassigned", "conflict"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field("duration_minutes", "Duration (minutes)", { type: "number" })}
          {field("enrollment", "Enrollment count", { type: "number" })}
          {field("window_start", "Window start", { type: "date" })}
          {field("window_end", "Window end", { type: "date" })}
          {field("required_equipment", "Required equipment (comma separated)", {
            placeholder: "Computers, Projector",
          })}
          {field("accommodations", "Accommodations (comma separated)", {
            placeholder: "Extra time 25%",
          })}
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {exam ? "Save changes" : "Create exam"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}