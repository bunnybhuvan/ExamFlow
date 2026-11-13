import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV } from "./nav";
import { useExams, useRooms, useStudents } from "@/lib/data-source";
import { useAppActions } from "./app-actions-context";

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const nav = useNavigate();
  const { openSchedule, openDataset } = useAppActions();
  const exams = useExams().data ?? [];
  const students = useStudents().data ?? [];
  const rooms = useRooms().data ?? [];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const go = (fn: () => void) => {
    setOpen(false);
    setSearch("");
    fn();
  };
  const matches = (text: string) => text.toLowerCase().includes(search.toLowerCase());
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent md:w-72"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Search exams, students, rooms…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type to search…" value={search} onValueChange={setSearch} />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go(openSchedule)}>Generate schedule</CommandItem>
            <CommandItem onSelect={() => go(openDataset)}>Generate synthetic dataset</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Pages">
            {NAV.map((n) => (
              <CommandItem key={n.url} onSelect={() => go(() => nav({ to: n.url }))}>
                <n.icon />
                {n.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Exams">
            {exams
              .filter((e) => matches(`${e.course_code} ${e.course_name}`))
              .slice(0, 50)
              .map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.course_code} ${e.course_name}`}
                  onSelect={() => go(() => nav({ to: "/exams", search: { q: e.course_code } }))}
                >
                  {e.course_code} · {e.course_name}
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Students">
            {students
              .filter((s) => matches(`${s.name} ${s.id}`))
              .slice(0, 50)
              .map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.name} ${s.id}`}
                  onSelect={() => go(() => nav({ to: "/students", search: { id: s.id } }))}
                >
                  {s.name}{" "}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{s.id}</span>
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Rooms">
            {rooms.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.name} ${r.building}`}
                onSelect={() => go(() => nav({ to: "/rooms" }))}
              >
                {r.name} · {r.building}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}