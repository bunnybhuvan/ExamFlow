import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Database, RefreshCw, Save, Server } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/app/primitives";
import { useAppActions } from "@/components/app/app-actions-context";
import { useDatabaseHealth, useDataSource } from "@/lib/data-source";
import { API_BASE_URL } from "@/lib/api";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  type SchedulingSettings,
} from "@/lib/settings";
import { validateSchedule } from "@/lib/schedule-validation";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings — ExamFlow" },
      {
        name: "description",
        content: "Scheduling preferences, time windows, buffers and API status.",
      },
      { property: "og:title", content: "Settings — ExamFlow" },
      {
        property: "og:description",
        content: "Scheduling preferences, time windows, buffers and API status.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<SchedulingSettings>(DEFAULT_SETTINGS);
  useEffect(() => setS(getSettings()), []);
  const { mode, healthError, retry } = useDataSource();
  const db = useDatabaseHealth();
  const { openDataset } = useAppActions();
  const set = <K extends keyof SchedulingSettings>(k: K, v: SchedulingSettings[K]) =>
    setS((x) => ({ ...x, [k]: v }));
  const error =
    validateSchedule(s) || (s.break_buffer_minutes > 240 ? "Buffer must be 0–240 minutes" : null);
  const save = () => {
    if (error) {
      toast.error(error);
      return;
    }
    try {
      saveSettings(s);
      toast.success("Scheduling preferences saved", {
        description: "Used as defaults for the next Generate Schedule run.",
      });
    } catch {
      toast.error("Could not save preferences", { description: "Browser storage is unavailable." });
    }
  };
  return (
    <div className="page-enter space-y-6">
      <PageHeader
        title="Settings"
        actions={
          <Button variant="brand" onClick={save}>
            <Save /> Save preferences
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Exam session window">
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Session start">
                <Input
                  type="date"
                  value={s.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
              </F>
              <F label="Session end">
                <Input
                  type="date"
                  value={s.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                />
              </F>
              <F label="Daily start time">
                <Input
                  type="time"
                  value={s.daily_start}
                  onChange={(e) => set("daily_start", e.target.value)}
                />
              </F>
              <F label="Daily end time">
                <Input
                  type="time"
                  value={s.daily_end}
                  onChange={(e) => set("daily_end", e.target.value)}
                />
              </F>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch id="wk" disabled checked={s.allow_weekends} />
                <Label htmlFor="wk">Allow weekend exams (not supported by API)</Label>
              </div>
            </div>
          </Panel>
          <Panel title="Scheduling preferences">
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Break buffer between exams (minutes)">
                <Input
                  type="number"
                  min={0}
                  max={240}
                  value={s.break_buffer_minutes}
                  onChange={(e) => set("break_buffer_minutes", Number(e.target.value))}
                />
              </F>
              <F label="Max exams per student per day (not supported by API)">
                <Input type="number" disabled value={s.max_exams_per_student_per_day} />
              </F>
              <F label="Strategy">
                <Select
                  value={s.strategy}
                  onValueChange={(v) => set("strategy", v as SchedulingSettings["strategy"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="spread">Spread</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Deterministic seed">
                <Input
                  type="number"
                  value={s.seed}
                  onChange={(e) => set("seed", Number(e.target.value))}
                  className="font-mono"
                />
              </F>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              The same seed and inputs always yield the same schedule, making runs reproducible and
              auditable.
            </p>
            {error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel
            title="API connection"
            actions={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  retry();
                  if (mode === "api") db.refetch();
                }}
              >
                <RefreshCw /> Check
              </Button>
            }
          >
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Server className="size-4" />
                  API
                </dt>
                <dd>
                  {mode === "api" ? (
                    <Badge variant="success">Connected</Badge>
                  ) : mode === "demo" ? (
                    <Badge variant="warning">Unavailable · Demo</Badge>
                  ) : (
                    <Badge variant="muted">Checking…</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Database className="size-4" />
                  Database
                </dt>
                <dd>
                  {mode !== "api" ? (
                    <Badge variant="muted">n/a</Badge>
                  ) : db.isPending ? (
                    <Badge variant="muted">Checking…</Badge>
                  ) : db.isSuccess ? (
                    <Badge variant="success">{db.data.database ?? db.data.status}</Badge>
                  ) : (
                    <Badge variant="danger">Error</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Base URL</dt>
                <dd className="mt-1 break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                  {API_BASE_URL}
                </dd>
              </div>
              {healthError && (
                <div>
                  <dt className="text-muted-foreground">Last error</dt>
                  <dd className="mt-1 text-xs text-destructive">{healthError}</dd>
                </div>
              )}
              {mode === "api" && db.error && (
                <div role="alert" className="text-xs text-destructive">
                  {db.error.message}
                </div>
              )}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Set <code className="font-mono">VITE_API_BASE_URL</code> to point at a different
              FastAPI server.
            </p>
          </Panel>
          <Panel title="Synthetic data">
            <p className="mb-3 text-sm text-muted-foreground">
              Replace the dataset with seeded synthetic students, exams, rooms and staff.
            </p>
            <Button variant="subtle" onClick={openDataset}>
              <Database /> Generate dataset
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
