import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
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
        <Link to="/" className="flex items-center gap-3 px-2 py-1.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f0a64b] text-[#17263d]">
            <CalendarDays className="size-[18px]" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block text-[15px] font-semibold tracking-[-0.04em] text-[#f7f3e9]">
              ExamFlow
            </span>
            <span className="mt-0.5 block text-[10px] font-medium tracking-[0.08em] text-[#9aabc1]">
              EXAM OPERATIONS
            </span>
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
            <div className="flex items-center gap-2 rounded-md border border-[#e5eae7] bg-[#f5f7f5] px-3 py-2.5 text-xs text-[#657478]">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  mode === "api"
                    ? "bg-[#36c28a]"
                    : mode === "demo"
                      ? "bg-[#f0a64b]"
                      : "animate-pulse bg-[#92a4bd]",
                )}
              />
              <span className="group-data-[collapsible=icon]:hidden">
                {mode === "api" ? "Connected to API" : mode === "demo" ? "Demo data" : "Connecting"}
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
