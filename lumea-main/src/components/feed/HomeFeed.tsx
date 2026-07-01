"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { PostCard, PostCardSkeleton } from "./PostCard";
import { api } from "@/lib/api";

export function HomeFeed() {
  const params = useSearchParams();
  const topic = params.get("topic") ?? undefined;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts", { topic }],
    queryFn: ({ pageParam }) => api.getPosts({ topic, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });

  // Infinite scroll — observe the bottom sentinel
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allPosts = data?.pages.flatMap((p) => p.posts) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!allPosts.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">No posts found.</p>
      </div>
    );
  }

  const [featured, ...rest] = allPosts;

  return (
    <div className="space-y-10">
      {/* Featured post */}
      {featured && (
        <div className="pb-8 border-b border-border/60">
          <PostCard post={featured} featured />
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
        {rest.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {/* Load more sentinel */}
      <div ref={loadMoreRef} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {Array.from({ length: 3 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
