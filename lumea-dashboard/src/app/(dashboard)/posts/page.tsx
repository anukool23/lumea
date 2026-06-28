"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postApi } from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PenSquare, Trash2, Eye, EyeOff, Lock, Unlock, Archive } from "lucide-react";

type StatusFilter = "all" | "published" | "draft" | "scheduled" | "archived";

export default function PostsListPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-posts", status],
    queryFn: () => postApi.list({ status: status === "all" ? undefined : status, limit: 50 }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => postApi.delete(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-posts"] }),
  });

  const publishMutation = useMutation({
    mutationFn: (postId: string) => postApi.publish(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-posts"] }),
  });

  const unpublishMutation = useMutation({
    mutationFn: (postId: string) => postApi.unpublish(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-posts"] }),
  });

  const togglePremiumMutation = useMutation({
    mutationFn: (postId: string) => postApi.togglePremium(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-posts"] }),
  });

  const posts = data?.data ?? [];
  const TABS: StatusFilter[] = ["all", "published", "draft", "scheduled", "archived"];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Stories</h1>
        <Link href="/posts/new" className="btn-primary">
          <PenSquare className="w-4 h-4" /> New story
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-200">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setStatus(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              status === tab ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}>{tab}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="card p-4 h-16 animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-12 text-center text-zinc-400">
          <PenSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No stories {status !== "all" ? `with status "${status}"` : "yet"}.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">STORY</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden sm:table-cell">STATUS</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 hidden md:table-cell">STATS</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden lg:table-cell">UPDATED</th>
                <th className="px-5 py-3 text-xs font-medium text-zinc-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {posts.map((post: any) => (
                <tr key={post.postId} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/posts/${post.postId}`} className="text-sm font-medium hover:underline line-clamp-1">
                      {post.isPremium && <Lock className="inline w-3 h-3 text-amber-500 mr-1 mb-0.5" />}
                      {post.title}
                    </Link>
                    <p className="text-xs text-zinc-400 mt-0.5">{post.readingTimeMin} min read</p>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      post.status === "published" ? "bg-green-100 text-green-700" :
                      post.status === "draft" ? "bg-zinc-100 text-zinc-600" :
                      post.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                      "bg-zinc-100 text-zinc-400"
                    }`}>{post.status}</span>
                  </td>
                  <td className="px-4 py-4 text-right hidden md:table-cell">
                    <span className="text-xs text-zinc-400">{post.viewCount ?? 0} views · {post.likeCount ?? 0} ♥</span>
                  </td>
                  <td className="px-4 py-4 text-xs text-zinc-400 hidden lg:table-cell">
                    {formatDistanceToNow(new Date(post.updatedAt), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      {post.status === "draft" && (
                        <button onClick={() => publishMutation.mutate(post.postId)} title="Publish"
                          className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-green-600 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {post.status === "published" && (
                        <button onClick={() => unpublishMutation.mutate(post.postId)} title="Unpublish"
                          className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
                          <EyeOff className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => togglePremiumMutation.mutate(post.postId)} title="Toggle premium"
                        className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-amber-600 transition-colors">
                        {post.isPremium ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </button>
                      <Link href={`/posts/${post.postId}`}
                        className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors" title="Edit">
                        <PenSquare className="w-4 h-4" />
                      </Link>
                      <button onClick={() => { if (confirm("Delete this story?")) deleteMutation.mutate(post.postId); }}
                        className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
