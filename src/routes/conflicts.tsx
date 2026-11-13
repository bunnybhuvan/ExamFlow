import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Lightbulb } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageHeader,
  Panel,
  SeverityBadge,
  LoadingBlock,
  ErrorState,
  EmptyState,
} from "@/components/app/primitives";
import { useSchedules, useUnassigned, useValidation } from "@/lib/data-source";
import { deriveConflicts } from "@/lib/conflicts";
import type { Severity } from "@/lib/types";

export const Route = createFileRoute("/conflicts")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Conflicts — ExamFlow" },
      {
        name: "description",
        content: "Categorized scheduling issue queue with remediation guidance.",
      },
      { property: "og:title", content: "Conflicts — ExamFlow" },
      {
        property: "og:description",
        content: "Categorized scheduling issue queue with remediation guidance.",
      },
    ],
  }),
  component: ConflictsPage,
});

const ENTITY_ROUTE = {
  exam: "/exams",
  student: "/students",
  room: "/rooms",
  invigilator: "/invigilators",
} as const;

function ConflictsPage() {
  const v = useValidation(),
    u = useUnassigned(),
    s = useSchedules();
  const [cat, setCat] = useState("all");
  const [sev, setSev] = useState<Severity | "all">("all");
  const all = deriveConflicts(v.data, u.data, s.data);
  const cats = Array.from(new Set(all.map((c) => c.category)));
  const items = all.filter(
    (c) => (cat === "all" || c.category === cat) && (sev === "all" || c.severity === sev),
  );
  const counts = (["critical", "high", "medium", "low"] as const).map(
    (k) => [k, all.filter((c) => c.severity === k).length] as const,
  );
  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Conflicts"
        description="Every issue the solver and validators surfaced, ranked by severity."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map(([k, n]) => (
          <button
            key={k}
            onClick={() => setSev(sev === k ? "all" : k)}
            aria-pressed={sev === k}
            className={`glass rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 ${sev === k ? "ring-2 ring-ring" : ""}`}
          >
            <SeverityBadge severity={k} />
            <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{n}</div>
          </button>
        ))}
      </div>
      <Tabs value={cat} onValueChange={setCat}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          {cats.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {v.error || u.error || s.error ? (
        <ErrorState
          error={v.error || u.error || s.error}
          onRetry={() => {
            v.refetch();
            u.refetch();
            s.refetch();
          }}
        />
      ) : v.isPending || u.isPending || s.isPending ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <Panel>
          <EmptyState
            title="No conflicts in this view"
            description="The schedule satisfies all checks for this filter."
          />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li
              key={c.id}
              className="glass rounded-xl p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={c.severity} />
                <span className="text-xs text-muted-foreground">{c.category}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-cyan">
                  {c.reason_code}
                </code>
                {c.entity_type in ENTITY_ROUTE && (
                  <Link
                    to={ENTITY_ROUTE[c.entity_type as keyof typeof ENTITY_ROUTE]}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {c.entity_type} {c.entity_id}
                    <ArrowUpRight className="size-3" />
                  </Link>
                )}
              </div>
              <p className="mt-2 text-sm font-medium">{c.title}</p>
              <p className="mt-2 flex gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-foreground/90">
                <Lightbulb className="size-4 shrink-0 text-primary" />
                {c.remediation}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
