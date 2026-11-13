import { createFileRoute } from "@tanstack/react-router";
import { Accessibility, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Chips, Meter, Panel } from "@/components/app/primitives";
import { DataTable, type Column } from "@/components/app/data-table";
import { HBarChart } from "@/components/charts/charts";
import { useRooms } from "@/lib/data-source";
import { fmtDate, pct } from "@/lib/format";
import type { Room } from "@/lib/types";

export const Route = createFileRoute("/rooms")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Rooms — ExamFlow" },
      { name: "description", content: "Room capacity, equipment, closures and utilization." },
      { property: "og:title", content: "Rooms — ExamFlow" },
      {
        property: "og:description",
        content: "Room capacity, equipment, closures and utilization.",
      },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const rooms = useRooms();
  const cols: Column<Room>[] = [
    {
      id: "name",
      header: "Room",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">{r.building}</div>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      id: "cap",
      header: "Capacity",
      cell: (r) => <span className="tabular-nums">{r.capacity}</span>,
      sortValue: (r) => r.capacity,
    },
    {
      id: "eq",
      header: "Equipment",
      cell: (r) => <Chips items={r.equipment} />,
      className: "hidden lg:table-cell",
    },
    {
      id: "acc",
      header: "Access",
      cell: (r) =>
        r.accessible ? (
          <Badge variant="success" className="gap-1">
            <Accessibility className="size-3" />
            Accessible
          </Badge>
        ) : (
          <Badge variant="muted">Standard</Badge>
        ),
    },
    {
      id: "avail",
      header: "Availability",
      cell: (r) =>
        r.closures.length ? (
          <div className="space-y-0.5">
            {r.closures.map((c, i) => (
              <div key={i} className="flex items-center gap-1 text-xs text-warning">
                <Ban className="size-3" />
                {fmtDate(c.start)}–{fmtDate(c.end)} · {c.reason}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-success">Open all session</span>
        ),
    },
    {
      id: "util",
      header: "Utilization",
      cell: (r) => (
        <div className="w-32">
          <div className="mb-1 text-xs tabular-nums">{pct(r.utilization)}</div>
          <Meter value={r.utilization} />
        </div>
      ),
      sortValue: (r) => r.utilization,
    },
  ];
  return (
    <div className="page-enter space-y-6">
      <PageHeader
        title="Rooms"
        description="Examination venues, their constraints and how hard they're working."
      />
      {rooms.data && rooms.data.length > 0 && (
        <Panel title="Utilization by room" description="Share of available slots in use">
          <HBarChart
            data={[...rooms.data].sort((a, b) => b.utilization - a.utilization).slice(0, 12)}
            dataKey="utilization"
            nameKey="name"
            percent
          />
        </Panel>
      )}
      <DataTable
        data={rooms.data}
        loading={rooms.isPending}
        error={rooms.error}
        onRetry={() => rooms.refetch()}
        columns={cols}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.name} ${r.building} ${r.equipment.join(" ")}`}
        searchPlaceholder="Search rooms, buildings, equipment…"
      />
    </div>
  );
}
