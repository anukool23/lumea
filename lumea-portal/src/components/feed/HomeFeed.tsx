"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PostCard, type Post } from "./PostCard";
import { content } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Flame, Rss, Compass } from "lucide-react";

const FEED_TYPES = [
  { key: "trending", label: "Trending", icon: Flame },
  { key: "following", label: "Following", icon: Rss },
  { key: "explore", label: "Explore", icon: Compass },
] as const;

type FeedType = (typeof FEED_TYPES)[number]["key"];

export function HomeFeed() {
  const { isAuthenticated } = useAuthStore();
  const [feedType, setFeedType] = useState<FeedType>("trending");
  const [activeTag, setActiveTag] = useState<string>();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["feed", feedType, activeTag],
    queryFn: ({ pageParam = 1 }) =>
      content.getFeed({ type: feedType, page: pageParam as number, tag: activeTag }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (last: any) => last.hasMore ? last.page + 1 : undefined,
    enabled: feedType !== "following" || isAuthenticated,
  });

  const posts = data?.pages.flatMap((p: any) => p.data) ?? [];

  return (
    <div>
      {/* Feed tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-zinc-200">
        {FEED_TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { if (key === "following" && !isAuthenticated) return; setFeedType(key); }}
            disabled={key === "following" && !isAuthenticated}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              feedType === key ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400 hover:text-zinc-600"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 bg-zinc-200 rounded-full" />
                <div className="h-4 bg-zinc-200 rounded w-28" />
              </div>
              <div className="h-6 bg-zinc-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-zinc-200 rounded w-full mb-1" />
              <div className="h-4 bg-zinc-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post: Post) => (
            <PostCard key={post.postId} post={post} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="text-center mt-8">
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn-outline">
            {isFetchingNextPage ? "Loading..." : "Load more stories"}
          </button>
        </div>
      )}

      {posts.length === 0 && !isLoading && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-lg mb-2">No stories yet.</p>
          {feedType === "following" && <p className="text-sm">Follow some writers to see their stories here.</p>}
        </div>
      )}
    </div>
  );
}
