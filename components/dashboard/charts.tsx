"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const C = { brand: "#2563c9", navy: "#0b1f3a", ai: "#6d5bd0", green: "#16a34a", amber: "#d97706", grid: "#e2e7ee", muted: "#5d6b7e" };
const PIE = [C.muted, C.brand, C.amber, C.green];
const axis = { fontSize: 11, fill: C.muted };
const mon = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });

export interface MonthRow { month: string; generated: number; manualHours: number; aiHours: number; turnaroundDays: number | null }

export function MonthlyDocsChart({ data }: { data: MonthRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="month" tickFormatter={mon} tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip labelFormatter={(m) => mon(String(m))} formatter={(v) => [v, "Documents"]} />
        <Bar isAnimationActive={false} dataKey="generated" fill={C.brand} radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data, color = C.navy, label }: { data: { name: string; value: number }[]; color?: string; label: string }) {
  const h = Math.max(160, data.length * 34 + 30);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={C.grid} />
        <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={{ ...axis, fill: "#16202e" }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v) => [v, label]} />
        <Bar isAnimationActive={false} dataKey="value" fill={color} radius={[0, 3, 3, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="#fff">
          {data.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
        </Pie>
        <Tooltip />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ManualVsAiChart({ data }: { data: MonthRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="month" tickFormatter={mon} tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit="h" />
        <Tooltip labelFormatter={(m) => mon(String(m))} formatter={(v, n) => [`${v} h`, n === "manualHours" ? "Manual (estimated)" : "With AI"]} />
        <Legend formatter={(v) => (v === "manualHours" ? "Manual (estimated)" : "With AI")} wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="manualHours" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar isAnimationActive={false} dataKey="aiHours" fill={C.ai} radius={[3, 3, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TurnaroundChart({ data }: { data: MonthRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="month" tickFormatter={mon} tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit="d" />
        <Tooltip labelFormatter={(m) => mon(String(m))} formatter={(v) => [`${v} days`, "Avg. submit → approve"]} />
        <Line isAnimationActive={false} type="monotone" dataKey="turnaroundDays" stroke={C.green} strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
