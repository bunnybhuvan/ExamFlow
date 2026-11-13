import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV } from "./nav";
import { useDataSource } from "@/lib/data-source";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { mode } = useDataSource();
  const groups = Array.from(new Set(NAV.map((n) => n.group)));
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2.5 px-1 py-1.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-gradient shadow-glow">
            <CalendarCheck2 className="size-4 text-primary-foreground" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            ExamFlow
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g}>
            <SidebarGroupLabel>{g}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((n) => n.group === g).map((n) => {
                  const active = n.url === "/" ? path === "/" : path.startsWith(n.url);
                  return (
                    <SidebarMenuItem key={n.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={n.title}>
                        <Link to={n.url}>
                          <n.icon />
                          <span>{n.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/80">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  mode === "api"
                    ? "bg-success"
                    : mode === "demo"
                      ? "bg-warning"
                      : "bg-muted-foreground animate-pulse",
                )}
              />
              <span className="group-data-[collapsible=icon]:hidden">
                {mode === "api" ? "API connected" : mode === "demo" ? "Demo mode" : "Connecting…"}
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}