"use client";

import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { PostCard, PostCardSkeleton } from "@/components/feed/PostCard";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import Link from "next/link";

export default function BookmarksPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => api.getBookmarks(),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
        <Bookmark className="h-10 w-10 text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
        <h1 className="text-xl font-semibold mb-2">Your bookmarks</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Save posts to read later. Sign in to access your bookmarks.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-9 px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const posts = data?.posts ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-16">
      <div className="flex items-center gap-2 mb-8">
        <Bookmark className="h-5 w-5" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold tracking-tight">Bookmarks</h1>
        {posts.length > 0 && (
          <span className="text-sm text-muted-foreground ml-1">({posts.length})</span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">
            No bookmarks yet. Hit the bookmark icon on any post to save it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
