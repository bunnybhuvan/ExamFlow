import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronRight, Database, Sparkles } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NAV } from "./nav";
import { CommandSearch } from "./command-search";
import { useAppActions } from "./app-actions-context";
import { useUnassigned, useValidation } from "@/lib/data-source";
import { deriveConflicts } from "@/lib/conflicts";
import { SeverityBadge } from "./primitives";

export function TopBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const page = NAV.find((n) => (n.url === "/" ? path === "/" : path.startsWith(n.url)));
  const { openSchedule, openDataset } = useAppActions();
  const validation = useValidation(),
    unassigned = useUnassigned();
  const issues = deriveConflicts(validation.data, unassigned.data).slice(0, 6);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/75 px-3 backdrop-blur-xl md:px-5">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm lg:flex">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ExamFlow
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">{page?.title ?? "Overview"}</span>
      </nav>
      <div className="flex min-w-0 flex-1 justify-center px-2">
        <CommandSearch />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications (${issues.length})`}
            className="relative"
          >
            <Bell />
            {issues.length > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Open issues</div>
          <ul className="max-h-80 overflow-auto">
            {validation.error || unassigned.error ? (
              <li role="alert" className="px-4 py-6 text-center text-sm text-destructive">
                Could not load all issues. Open the conflict queue to retry.
              </li>
            ) : validation.isPending || unassigned.isPending ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                Loading issues…
              </li>
            ) : (
              issues.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">All clear.</li>
              )
            )}
            {issues.map((c) => (
              <li key={c.id} className="border-b border-border px-4 py-2.5 last:border-0">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={c.severity} />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {c.reason_code}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-foreground">{c.title}</p>
              </li>
            ))}
          </ul>
          <Link
            to="/conflicts"
            className="block border-t border-border px-4 py-2 text-center text-xs text-primary hover:underline"
          >
            View conflict queue
          </Link>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Profile menu"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-accent text-xs">RO</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            Registrar Office
            <div className="text-xs font-normal text-muted-foreground">Local MVP · no sign-in</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openDataset}>
            <Database /> Generate dataset
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings">Settings</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="brand"
        onClick={openSchedule}
        aria-label="Generate Schedule"
        className="shrink-0"
      >
        <Sparkles />
        <span className="hidden sm:inline">Generate Schedule</span>
      </Button>
    </header>
  );
}
