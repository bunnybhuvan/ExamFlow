import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Panel,
  KpiCard,
  StatusBadge,
  SeverityBadge,
  LoadingBlock,
  ErrorState,
} from "@/components/app/primitives";
import { useValidation } from "@/lib/data-source";
import { fmtDateTime } from "@/lib/format";
import type { ValidationCheck } from "@/lib/types";

export const Route = createFileRoute("/validation")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Validation — ExamFlow" },
      { name: "description", content: "Constraint validation summary and data integrity checks." },
      { property: "og:title", content: "Validation — ExamFlow" },
      {
        property: "og:description",
        content: "Constraint validation summary and data integrity checks.",
      },
    ],
  }),
  component: ValidationPage,
});

const GROUPS: { key: ValidationCheck["category"]; title: string; desc: string }[] = [
  { key: "hard", title: "Hard constraints", desc: "Must never be violated" },
  { key: "soft", title: "Soft constraints", desc: "Quality preferences the solver optimizes" },
  { key: "integrity", title: "Data integrity", desc: "Consistency of the underlying dataset" },
];

function ValidationPage() {
  const v = useValidation();
  const r = v.data;
  const hardFails =
    r?.checks
      .filter((c) => c.category === "hard" && c.status === "fail")
      .reduce((a, c) => a + c.violations, 0) ?? 0;
  return (
    <div className="page-enter space-y-6">
      <PageHeader
        title="Validation"
        description={
          r
            ? `Report generated ${fmtDateTime(r.generated_at)}`
            : "Independent checks run against the current schedule."
        }
        actions={
          <Button variant="subtle" onClick={() => v.refetch()} disabled={v.isFetching}>
            <RefreshCw className={v.isFetching ? "animate-spin" : ""} /> Re-run
          </Button>
        }
      />
      {v.error ? (
        <ErrorState error={v.error} onRetry={() => v.refetch()} />
      ) : !r ? (
        <LoadingBlock rows={8} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Passed" value={r.passed} icon={CheckCircle2} tone="success" />
            <KpiCard label="Failed" value={r.failed} icon={XCircle} tone="danger" />
            <KpiCard label="Warnings" value={r.warnings} icon={AlertCircle} tone="warning" />
            <KpiCard
              label="Hard violations"
              value={hardFails}
              icon={XCircle}
              tone={hardFails ? "danger" : "success"}
            />
          </div>
          {GROUPS.map((g) => {
            const checks = r.checks.filter((c) => c.category === g.key);
            if (!checks.length) return null;
            return (
              <Panel key={g.key} title={g.title} description={g.desc} bodyClassName="p-0">
                <Accordion type="multiple">
                  {checks.map((c) => (
                    <AccordionItem key={c.id} value={c.id} className="border-border px-5">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-1 flex-wrap items-center gap-3 text-left">
                          {c.status === "pass" ? (
                            <CheckCircle2 className="size-4 text-success" />
                          ) : c.status === "fail" ? (
                            <XCircle className="size-4 text-destructive" />
                          ) : (
                            <AlertCircle className="size-4 text-warning" />
                          )}
                          <span className="font-medium">{c.name}</span>
                          <StatusBadge status={c.status} />
                          {c.violations > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {c.violations} violation{c.violations > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="mb-3 text-sm text-muted-foreground">
                          {c.description} <SeverityBadge severity={c.severity} />
                        </p>
                        {c.details.length === 0 ? (
                          <p className="text-sm text-success">No violations found.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {c.details.map((d, i) => (
                              <li
                                key={i}
                                className="flex gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                              >
                                <code className="shrink-0 font-mono text-xs text-cyan">
                                  {d.entity_type}:{d.entity_id}
                                </code>
                                <span>{d.message}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Panel>
            );
          })}
        </>
      )}
    </div>
  );
}