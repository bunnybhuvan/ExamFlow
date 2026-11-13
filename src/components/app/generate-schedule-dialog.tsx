import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDataSource, useGenerateSchedule } from "@/lib/data-source";
import { DEMO_SEED } from "@/lib/demo";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";
import { validateSchedule } from "@/lib/schedule-validation";
import type { GenerateScheduleParams, GenerateScheduleResult } from "@/lib/types";

export function GenerateScheduleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { mode } = useDataSource();
  const s = DEFAULT_SETTINGS;
  const [p, setP] = useState<GenerateScheduleParams>({
    start_date: s.start_date,
    end_date: s.end_date,
    daily_start: s.daily_start,
    daily_end: s.daily_end,
    break_buffer_minutes: s.break_buffer_minutes,
    seed: s.seed ?? DEMO_SEED,
    strategy: s.strategy,
  });
  const [result, setResult] = useState<(GenerateScheduleResult & { demo: boolean }) | null>(null);
  const gen = useGenerateSchedule();
  useEffect(() => {
    if (!open) return;
    const settings = getSettings();
    setP({
      start_date: settings.start_date,
      end_date: settings.end_date,
      daily_start: settings.daily_start,
      daily_end: settings.daily_end,
      break_buffer_minutes: settings.break_buffer_minutes,
      seed: settings.seed,
      strategy: settings.strategy,
    });
    setResult(null);
  }, [open]);
  const invalid = validateSchedule(p);

  const run = () => {
    if (invalid) return;
    setResult(null);
    gen.mutate(p, {
      onSuccess: (r) => {
        setResult(r);
        toast.success(r.demo ? "Demo schedule generated (local fixture)" : "Schedule generated", {
          description: `${r.scheduled} scheduled · ${r.unassigned} unassigned`,
        });
      },
      onError: (e) =>
        toast.error("Schedule generation failed", { description: (e as Error).message }),
    });
  };
  const set = <K extends keyof GenerateScheduleParams>(k: K, v: GenerateScheduleParams[K]) =>
    setP((x) => ({ ...x, [k]: v }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!gen.isPending) {
          onOpenChange(o);
          if (!o) setResult(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Generate schedule
          </DialogTitle>
          <DialogDescription>
            Runs the constraint solver via{" "}
            <code className="font-mono text-xs">POST /schedules/generate</code>.
            {mode === "demo" && (
              <Badge variant="warning" className="ml-2">
                Demo mode · fixed-scale fixture, not a constraint solver
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        {!result ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <Input
                type="date"
                value={p.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </Field>
            <Field label="End date">
              <Input
                type="date"
                value={p.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </Field>
            <Field label="Daily start">
              <Input
                type="time"
                value={p.daily_start}
                onChange={(e) => set("daily_start", e.target.value)}
              />
            </Field>
            <Field label="Daily end">
              <Input
                type="time"
                value={p.daily_end}
                onChange={(e) => set("daily_end", e.target.value)}
              />
            </Field>
            <Field label="Break buffer (min)">
              <Input
                type="number"
                min={0}
                value={p.break_buffer_minutes}
                onChange={(e) => set("break_buffer_minutes", Number(e.target.value))}
              />
            </Field>
            <Field label="Seed">
              <Input
                type="number"
                value={p.seed}
                onChange={(e) => set("seed", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Strategy">
                <Select
                  value={p.strategy}
                  onValueChange={(v) => set("strategy", v as GenerateScheduleParams["strategy"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced — even load across days</SelectItem>
                    <SelectItem value="compact">Compact — fewest exam days</SelectItem>
                    <SelectItem value="spread">Spread — maximize student rest</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {invalid && (
              <p role="alert" className="col-span-2 text-sm text-destructive">
                {invalid}
              </p>
            )}
            {gen.isPending && (
              <div className="col-span-2 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Solving constraints…
                </div>
                <Progress value={undefined} className="h-1.5 animate-pulse" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" />{" "}
              <span className="font-medium">
                Run {result.run_id} complete{result.demo && " (demo)"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Scheduled" value={result.scheduled} />
              <Stat label="Unassigned" value={result.unassigned} />
              <Stat label="Solve time" value={`${result.duration_ms} ms`} />
            </div>
            {(result.unassigned_items ?? []).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Unassigned reasons
                </p>
                <ul className="max-h-48 space-y-1.5 overflow-auto pr-1">
                  {(result.unassigned_items ?? []).map((u) => (
                    <li
                      key={u.exam_id}
                      className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-warning">{u.reason_code}</span>{" "}
                      <span className="font-medium">{u.course_code}</span>
                      <p className="text-xs text-muted-foreground">{u.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {result ? (
            <>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Run again
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  setResult(null);
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={gen.isPending}>
                Cancel
              </Button>
              <Button
                variant="brand"
                onClick={run}
                disabled={!!invalid || gen.isPending || mode === "checking"}
              >
                {gen.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="font-display text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
