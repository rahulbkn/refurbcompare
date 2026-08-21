"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatINR } from "@/lib/format";
const PALETTE = ["#249d61", "#1f6feb", "#f59e0b", "#e11d48", "#7c3aed", "#0e7490"];

export type ChartSeries = {
  sellerName: string;
  points: Array<{ recordedAt: string; price: number }>;
};

/**
 * Align every seller onto a shared (date -> {[seller]: price}) timeline,
 * sorted chronologically. Pure — exported for regression tests.
 */
export function alignSeries(series: ChartSeries[]): Array<Record<string, number | string>> {
  const byDate = new Map<string, Record<string, number>>();
  for (const { sellerName, points } of series) {
    for (const point of points) {
      const key = point.recordedAt.slice(0, 10);
      const bucket = byDate.get(key) ?? {};
      bucket[sellerName] = point.price;
      byDate.set(key, bucket);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));
}

export default function PriceHistoryChart({ series }: { series: ChartSeries[] }) {
  const data = alignSeries(series);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-muted)]">
        No price history available yet.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`}
            width={44}
          />
          <Tooltip
            formatter={(value: number | string) =>
              typeof value === "number" ? formatINR(value) : value
            }
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          {series.length > 1 && <Legend fontSize={12} />}
          {series.map(({ sellerName }, index) => (
            <Line
              key={sellerName}
              type="monotone"
              dataKey={sellerName}
              stroke={PALETTE[index % PALETTE.length]}
              strokeWidth={2}
              // A single historical point draws no line — show the dot so
              // valid history is never invisible just because it is sparse.
              dot={data.length <= 2 ? { r: 4 } : false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}