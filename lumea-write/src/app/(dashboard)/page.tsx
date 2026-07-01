"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PenLine, Eye, Heart, MessageSquare, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { formatRelativeDate } from "@/lib/utils";

export default function DashboardHome() {
  const { user } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getDashboardStats(),
    enabled: !!user,
  });

  const { data: recentPosts } = useQuery({
    queryKey: ["posts", { limit: 5 }],
    queryFn: () => api.getPosts({ limit: 5 }),
    enabled: !!user,
  });

  const statCards = [
    { label: "Total views",    value: stats?.totalViews    ?? 0, icon: Eye,          change: stats?.viewsChange    },
    { label: "Total likes",    value: stats?.totalLikes    ?? 0, icon: Heart,        change: stats?.likesChange    },
    { label: "Total comments", value: stats?.totalComments ?? 0, icon: MessageSquare,change: stats?.commentsChange },
    { label: "Followers",      value: stats?.followers     ?? 0, icon: TrendingUp,   change: stats?.followersChange },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Good {getGreeting()}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's how your writing is doing.</p>
        </div>
        <Link
          href="/posts/new"
          className="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground h-9 px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PenLine className="h-3.5 w-3.5" />
          New post
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, change }) => (
          <div key={label} className="rounded-xl border border-border/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tracking-tight">{value.toLocaleString()}</p>
            {change !== undefined && (
              <p className={`text-xs ${change >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {change >= 0 ? "↑" : "↓"} {Math.abs(change)}% this week
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Recent posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Recent posts</h2>
          <Link href="/posts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>
        <div className="rounded-xl border border-border/60 divide-y divide-border/60">
          {recentPosts?.posts.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No posts yet.</p>
              <Link href="/posts/new" className="text-sm font-medium hover:underline">
                Write your first post →
              </Link>
            </div>
          )}
          {recentPosts?.posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <Link href={`/posts/${post.id}`} className="text-sm font-medium hover:underline truncate block">
                  {post.title}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {post.status === "published"
                    ? `Published ${formatRelativeDate(post.publishedAt)}`
                    : post.status === "scheduled"
                    ? `Scheduled for ${formatRelativeDate(post.scheduledAt ?? "")}`
                    : "Draft"}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.views ?? 0}</span>
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{post.likesCount ?? 0}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  post.status === "published" ? "bg-emerald-100 text-emerald-700"
                  : post.status === "scheduled" ? "bg-blue-100 text-blue-700"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {post.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
