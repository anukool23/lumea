"use client";
import { useQuery } from "@tanstack/react-query";
import { postApi, analyticsApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Eye, Heart, FileText, Users, TrendingUp, PenSquare } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function OverviewPage() {
  const { user } = useAuthStore();

  const { data: statsData } = useQuery({
    queryKey: ["post-stats"],
    queryFn: () => postApi.stats().then(r => r.data),
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["analytics-overview", "7d"],
    queryFn: () => analyticsApi.overview("7d").then(r => r.data),
  });

  const stats = [
    { label: "Total views", value: analyticsData?.totalViews ?? 0, icon: Eye, color: "text-blue-500" },
    { label: "Total likes", value: analyticsData?.totalLikes ?? 0, icon: Heart, color: "text-red-500" },
    { label: "Published", value: statsData?.published ?? 0, icon: FileText, color: "text-green-500" },
    { label: "Followers", value: user?.followers_count ?? 0, icon: Users, color: "text-purple-500" },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Good {getGreeting()}, {user?.name?.split(" ")[0] ?? user?.username} 👋</h1>
          <p className="text-zinc-400 text-sm mt-1">Here's what's happening with your stories.</p>
        </div>
        <Link href="/posts/new" className="btn-primary">
          <PenSquare className="w-4 h-4" />
          New story
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-3xl font-bold">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {analyticsData?.trend && analyticsData.trend.length > 0 && (
        <div className="card p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-zinc-400" />
            <h2 className="font-semibold text-sm">Views — last 7 days</h2>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={analyticsData.trend}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }} />
              <Line type="monotone" dataKey="views" stroke="#18181b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent posts */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <h2 className="font-semibold">Recent stories</h2>
          <Link href="/posts" className="text-sm text-zinc-400 hover:text-zinc-700">View all</Link>
        </div>
        <RecentPostsList />
      </div>
    </div>
  );
}

function RecentPostsList() {
  const { data } = useQuery({
    queryKey: ["my-posts", 1],
    queryFn: () => postApi.list({ limit: 5 }).then(r => r.data),
  });

  const posts = data?.data ?? [];

  if (!posts.length) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <PenSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No stories yet.</p>
        <Link href="/posts/new" className="text-sm text-zinc-900 font-medium hover:underline mt-1 inline-block">
          Write your first story →
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      {posts.map((post: any) => (
        <Link key={post.postId} href={`/posts/${post.postId}`}
          className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{post.title}</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {post.status} · {post.viewCount ?? 0} views · {post.likeCount ?? 0} likes
            </p>
          </div>
          <StatusBadge status={post.status} />
        </Link>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-green-100 text-green-700",
    draft: "bg-zinc-100 text-zinc-600",
    scheduled: "bg-blue-100 text-blue-700",
    archived: "bg-zinc-100 text-zinc-400",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${map[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
