import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Exam, ExamInput } from "@/lib/types";

const list = z.string().transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean));
export const examSchema = z.object({
  course_code: z.string().trim().min(2, "Required").max(16).regex(/^[A-Z]{2,5}\d{2,4}[A-Z]?$/i, "Format like CS101"),
  course_name: z.string().trim().min(3, "At least 3 characters").max(120),
  department: z.string().trim().min(2, "Required").max(80),
  duration_minutes: z.coerce.number().int().min(30, "Min 30 minutes").max(480, "Max 8 hours"),
  enrollment: z.coerce.number().int().min(1, "At least 1").max(5000),
  window_start: z.string().min(1, "Required"),
  window_end: z.string().min(1, "Required"),
  required_equipment: list,
  accommodations: list,
  status: z.enum(["draft", "pending", "scheduled", "unassigned", "conflict"]),
}).refine((v) => v.window_end >= v.window_start, { path: ["window_end"], message: "End must be on/after start" });

type FormIn = z.input<typeof examSchema>;

export function ExamFormDialog({ open, onOpenChange, exam, onSubmit, saving }: {
  open: boolean; onOpenChange: (o: boolean) => void; exam?: Exam | null; onSubmit: (v: ExamInput) => void; saving: boolean;
}) {
  const f = useForm<FormIn, unknown, ExamInput>({ resolver: zodResolver(examSchema) });
  useEffect(() => {
    if (!open) return;
    f.reset(exam ? { ...exam, required_equipment: exam.required_equipment.join(", "), accommodations: exam.accommodations.join(", ") } : {
      course_code: "", course_name: "", department: "", duration_minutes: 120, enrollment: 50,
      window_start: "2026-12-07", window_end: "2026-12-18", required_equipment: "", accommodations: "", status: "pending",
    });
  }, [open, exam, f]);
  const err = f.formState.errors;
  const field = (name: keyof FormIn, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ex-${name}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={`ex-${name}`} aria-invalid={!!err[name]} {...f.register(name)} {...props} />
      {err[name] && <p className="text-xs text-destructive">{String(err[name]?.message)}</p>}
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{exam ? `Edit ${exam.course_code}` : "New exam"}</DialogTitle>
          <DialogDescription>Define the exam's constraints. The solver respects the date window, capacity, equipment and accommodations.</DialogDescription>
        </DialogHeader>
        <form onSubmit={f.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          {field("course_code", "Course code", { placeholder: "CS101", className: "font-mono uppercase" })}
          {field("course_name", "Course name")}
          {field("department", "Department")}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={f.watch("status")} onValueChange={(v) => f.setValue("status", v as ExamInput["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["draft", "pending", "scheduled", "unassigned", "conflict"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {field("duration_minutes", "Duration (minutes)", { type: "number" })}
          {field("enrollment", "Enrollment count", { type: "number" })}
          {field("window_start", "Window start", { type: "date" })}
          {field("window_end", "Window end", { type: "date" })}
          {field("required_equipment", "Required equipment (comma separated)", { placeholder: "Computers, Projector" })}
          {field("accommodations", "Accommodations (comma separated)", { placeholder: "Extra time 25%" })}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="brand" disabled={saving}>{saving && <Loader2 className="animate-spin" />}{exam ? "Save changes" : "Create exam"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}