"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PenLine, Trash2, Eye, MoreHorizontal, Search } from "lucide-react";
import { api } from "@/lib/api";
import { formatRelativeDate } from "@/lib/utils";

const STATUSES = ["all", "published", "draft", "scheduled"] as const;
type Status = typeof STATUSES[number];

export default function PostsPage() {
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["posts", { status, search }],
    queryFn: () => api.getPosts({ status: status === "all" ? undefined : status, search }),
  });

  const deletePost = useMutation({
    mutationFn: (id: string) => api.deletePost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  const posts = data?.posts ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Posts</h1>
        <Link
          href="/posts/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground h-9 px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PenLine className="h-3.5 w-3.5" />
          New post
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-muted">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors ${
                status === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Posts table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">No posts found.</p>
            <Link href="/posts/new" className="text-sm font-medium hover:underline">
              Write your first post →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Views</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/posts/${post.id}`} className="font-medium hover:underline line-clamp-1">
                      {post.title || <span className="text-muted-foreground italic">Untitled</span>}
                    </Link>
                    {post.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{post.excerpt}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      post.status === "published" ? "bg-emerald-100 text-emerald-700"
                      : post.status === "scheduled" ? "bg-blue-100 text-blue-700"
                      : "bg-muted text-muted-foreground"
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />{post.views ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {post.status === "published"
                      ? formatRelativeDate(post.publishedAt)
                      : post.status === "scheduled"
                      ? `Scheduled ${formatRelativeDate(post.scheduledAt ?? "")}`
                      : formatRelativeDate(post.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Link
                        href={`/posts/${post.id}`}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="Edit"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm("Delete this post?")) deletePost.mutate(post.id);
                        }}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
