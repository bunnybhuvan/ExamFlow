import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertOctagon, Inbox, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ExamStatus, Severity } from "@/lib/types";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-[1.7rem]">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("glass rounded-xl", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString(),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(),
      a = from.current,
      dur = 800;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur),
        e = 1 - Math.pow(1 - p, 3);
      setDisplay(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(display)}</>;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  format,
  hint,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
  format?: (n: number) => string;
  hint?: string;
  loading?: boolean;
}) {
  const toneCls = {
    brand: "text-primary bg-primary/15",
    success: "text-success bg-success/15",
    warning: "text-warning bg-warning/15",
    danger: "text-destructive bg-destructive/15",
    info: "text-info bg-info/15",
  }[tone];
  return (
    <div className="glass group relative overflow-hidden rounded-xl p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("grid size-8 place-items-center rounded-lg", toneCls)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tabular-nums text-foreground">
        {loading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <AnimatedNumber value={value} format={format} />
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LoadingBlock({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Unexpected error";
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-6 py-10 text-center"
    >
      <AlertOctagon className="size-6 text-destructive" />
      <div>
        <p className="font-medium text-foreground">Couldn't load this data</p>
        <p className="mt-1 text-sm text-muted-foreground">{msg}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="subtle" onClick={onRetry}>
          <RefreshCw /> Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-muted">
        <Inbox className="size-5 text-muted-foreground" />
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "info" | "muted" | "brand"
> = {
  scheduled: "success",
  confirmed: "success",
  pass: "success",
  pending: "info",
  tentative: "info",
  draft: "muted",
  unassigned: "warning",
  warn: "warning",
  conflict: "danger",
  fail: "danger",
};
export function StatusBadge({ status }: { status: ExamStatus | string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "muted"} className="capitalize">
      {status}
    </Badge>
  );
}
const SEV: Record<Severity, "danger" | "warning" | "info" | "muted"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "muted",
};
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant={SEV[severity]} className="capitalize">
      {severity}
    </Badge>
  );
}

export function Meter({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const tone = v > 0.85 ? "bg-destructive" : v > 0.6 ? "bg-warning" : "bg-brand-gradient";
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="meter"
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", tone)}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

export function Chips({ items, empty = "—" }: { items: string[]; empty?: string }) {
  if (!items.length) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Badge key={i} variant="muted" className="font-normal">
          {i}
        </Badge>
      ))}
    </div>
  );
}
