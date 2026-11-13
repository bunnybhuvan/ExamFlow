import {
  LayoutDashboard,
  CalendarRange,
  FileText,
  Users,
  DoorOpen,
  ShieldCheck,
  AlertTriangle,
  ListChecks,
  Download,
  History,
  Settings,
} from "lucide-react";
export const NAV = [
  { title: "Overview", url: "/", icon: LayoutDashboard, group: "Operate" },
  { title: "Schedule", url: "/schedule", icon: CalendarRange, group: "Operate" },
  { title: "Exams", url: "/exams", icon: FileText, group: "Data" },
  { title: "Students", url: "/students", icon: Users, group: "Data" },
  { title: "Rooms", url: "/rooms", icon: DoorOpen, group: "Data" },
  { title: "Invigilators", url: "/invigilators", icon: ShieldCheck, group: "Data" },
  { title: "Conflicts", url: "/conflicts", icon: AlertTriangle, group: "Quality" },
  { title: "Validation", url: "/validation", icon: ListChecks, group: "Quality" },
  { title: "Reports & Exports", url: "/reports", icon: Download, group: "Quality" },
  { title: "Audit Trail", url: "/audit", icon: History, group: "System" },
  { title: "Settings", url: "/settings", icon: Settings, group: "System" },
] as const;
export type NavUrl = (typeof NAV)[number]["url"];
