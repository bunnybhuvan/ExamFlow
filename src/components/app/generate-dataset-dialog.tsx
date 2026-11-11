import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDataSource, useGenerateDataset } from "@/lib/data-source";
import { DEMO_SEED } from "@/lib/demo";
import type { GenerateDatasetParams } from "@/lib/types";

const PRESETS: { label: string; p: Omit<GenerateDatasetParams, "seed"> }[] = [
  { label: "Small", p: { students: 500, exams: 60, rooms: 15, invigilators: 30 } },
  { label: "Faculty", p: { students: 5000, exams: 400, rooms: 60, invigilators: 150 } },
  { label: "University", p: { students: 25000, exams: 1800, rooms: 220, invigilators: 600 } },
];

export function GenerateDatasetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { mode } = useDataSource();
  const [p, setP] = useState<GenerateDatasetParams>({ ...PRESETS[1].p, seed: DEMO_SEED });
  const gen = useGenerateDataset();
  const bad = Object.values(p).some((v) => !Number.isFinite(v) || v < 0) || p.exams < 1 || p.rooms < 1;
  const run = () => gen.mutate(p, {
    onSuccess: (r) => {
      toast.success(r.demo ? "Demo dataset regenerated locally" : "Synthetic dataset generated", { description: `${r.students} students · ${r.exams} exams · ${r.rooms} rooms · ${r.invigilators} invigilators` });
      onOpenChange(false);
    },
    onError: (e) => toast.error("Dataset generation failed", { description: (e as Error).message }),
  });
  const field = (k: keyof GenerateDatasetParams, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ds-${k}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={`ds-${k}`} type="number" min={0} value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} className="font-mono" />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !gen.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Database className="size-4 text-cyan" /> Generate synthetic dataset</DialogTitle>
          <DialogDescription>
            Calls <code className="font-mono text-xs">POST /datasets/generate</code> and <strong>replaces</strong> current students, exams, rooms and invigilators with seeded synthetic data. Larger scales take longer and stress-test the solver.
            {mode === "demo" && <Badge variant="warning" className="ml-2">Demo mode · fixed demo scale</Badge>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {PRESETS.map((x) => <Button key={x.label} size="sm" variant="subtle" onClick={() => setP({ ...x.p, seed: p.seed })}>{x.label}</Button>)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field("students", "Students")}{field("exams", "Exams")}{field("rooms", "Rooms")}{field("invigilators", "Invigilators")}{field("seed", "Seed")}
          <div className="self-end rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
            ≈ {(p.students * 4).toLocaleString()} enrollments
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={gen.isPending}>Cancel</Button>
          <Button variant="brand" onClick={run} disabled={bad || gen.isPending || mode === "checking"}>
            {gen.isPending ? <Loader2 className="animate-spin" /> : <Database />} Generate dataset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}