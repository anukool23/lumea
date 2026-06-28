"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Eye, Heart, MessageCircle, TrendingUp } from "lucide-react";

const PERIODS = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30d");

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["analytics-overview", period],
    queryFn: () => analyticsApi.overview(period).then(r => r.data),
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["analytics-posts", period],
    queryFn: () => analyticsApi.posts(period).then(r => r.data),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === p.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total views", value: overview?.totalViews ?? 0, icon: Eye, delta: overview?.viewsDelta },
          { label: "Total likes", value: overview?.totalLikes ?? 0, icon: Heart, delta: overview?.likesDelta },
          { label: "Comments", value: overview?.totalComments ?? 0, icon: MessageCircle },
          { label: "Avg read time", value: `${overview?.avgReadTime ?? 0}m`, icon: TrendingUp },
        ].map(({ label, value, icon: Icon, delta }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
              <Icon className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
            {delta !== undefined && (
              <p className={`text-xs mt-1 ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                {delta >= 0 ? "+" : ""}{delta}% vs previous period
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Views trend chart */}
      {overview?.trend && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-sm mb-4">Views over time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={overview.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={35} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }} />
              <Line type="monotone" dataKey="views" stroke="#18181b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-post breakdown */}
      <div className="card">
        <div className="p-5 border-b border-zinc-100">
          <h2 className="font-semibold">Per-post breakdown</h2>
        </div>
        {postsLoading ? (
          <div className="p-8 text-center text-zinc-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">STORY</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">VIEWS</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 hidden sm:table-cell">LIKES</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 hidden md:table-cell">COMMENTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(postsData?.posts ?? []).map((p: any) => (
                <tr key={p.postId} className="hover:bg-zinc-50">
                  <td className="px-5 py-3 text-sm truncate max-w-xs">{p.title}</td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-600">{(p.views ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-600 hidden sm:table-cell">{(p.likes ?? 0).toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-right text-zinc-600 hidden md:table-cell">{(p.comments ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
