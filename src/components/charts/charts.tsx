import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
  },
  cursor: { fill: "color-mix(in oklab, var(--primary) 10%, transparent)" },
};

export function CoverageChart({
  data,
  height = 240,
}: {
  data: { label: string; scheduled: number; unassigned: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gSched" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gUn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Area
          type="monotone"
          dataKey="scheduled"
          name="Scheduled"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#gSched)"
        />
        <Area
          type="monotone"
          dataKey="unassigned"
          name="Unassigned"
          stroke="var(--chart-4)"
          strokeWidth={2}
          fill="url(#gUn)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({
  data,
  dataKey,
  nameKey,
  height = 280,
  color = "var(--chart-2)",
  percent,
}: {
  data: object[];
  dataKey: string;
  nameKey: string;
  height?: number;
  color?: string;
  percent?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          {...axis}
          tickFormatter={percent ? (v) => `${Math.round(v * 100)}%` : undefined}
        />
        <YAxis type="category" dataKey={nameKey} {...axis} width={110} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => (percent ? `${Math.round(v * 100)}%` : v)}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}
