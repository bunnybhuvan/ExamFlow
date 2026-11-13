import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  PageHeader,
  Panel,
  LoadingBlock,
  ErrorState,
  EmptyState,
} from "@/components/app/primitives";
import { useAudit } from "@/lib/data-source";
import { fmtDateTime, titleCase } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Audit Trail — ExamFlow" },
      {
        name: "description",
        content: "Append-only timeline of scheduling events with before/after diffs.",
      },
      { property: "og:title", content: "Audit Trail — ExamFlow" },
      {
        property: "og:description",
        content: "Append-only timeline of scheduling events with before/after diffs.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const audit = useAudit();
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");
  const data = audit.data ?? [];
  const entities = Array.from(new Set(data.map((e) => e.entity_type)));
  const items = data.filter(
    (e) =>
      (entity === "all" || e.entity_type === entity) &&
      (!q ||
        `${e.action} ${e.summary} ${e.actor} ${e.entity_id}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  return (
    <div className="page-enter">
      <PageHeader
        title="Audit Trail"
        description="Append-only record of every change. Entries cannot be edited or deleted."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by action, actor, entity…"
          className="w-72"
          aria-label="Filter events"
        />
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="w-44" aria-label="Entity type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e} value={e}>
                {titleCase(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Immutable log
        </span>
      </div>
      {audit.error ? (
        <ErrorState error={audit.error} onRetry={() => audit.refetch()} />
      ) : audit.isPending ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <Panel>
          <EmptyState title="No events" />
        </Panel>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-6">
          {items.map((e) => (
            <EventItem key={e.id} e={e} />
          ))}
        </ol>
      )}
    </div>
  );
}

function EventItem({ e }: { e: AuditEvent }) {
  const hasDiff = !!(e.before || e.after);
  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-4 size-2.5 rounded-full bg-brand-gradient ring-4 ring-background" />
      <Collapsible className="glass rounded-xl">
        <CollapsibleTrigger
          disabled={!hasDiff}
          className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
        >
          <code className="font-mono text-xs text-cyan">{e.action}</code>
          <span className="flex-1 text-sm">{e.summary}</span>
          <span className="text-xs text-muted-foreground">
            {e.actor} · {fmtDateTime(e.timestamp)}
          </span>
          {hasDiff && (
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          )}
        </CollapsibleTrigger>
        {hasDiff && (
          <CollapsibleContent className="grid gap-3 border-t border-border p-4 md:grid-cols-2">
            {(["before", "after"] as const).map((k) => (
              <div key={k}>
                <div
                  className={`mb-1 text-xs font-medium uppercase tracking-wider ${k === "before" ? "text-destructive" : "text-success"}`}
                >
                  {k}
                </div>
                <pre className="overflow-auto rounded-md bg-muted/60 p-3 font-mono text-xs">
                  {e[k] ? JSON.stringify(e[k], null, 2) : "—"}
                </pre>
              </div>
            ))}
            <p className="font-mono text-[11px] text-muted-foreground md:col-span-2">
              {e.id} · {e.entity_type}:{e.entity_id}
            </p>
          </CollapsibleContent>
        )}
      </Collapsible>
    </li>
  );
}