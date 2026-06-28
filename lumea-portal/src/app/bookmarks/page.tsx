"use client";
import { useQuery } from "@tanstack/react-query";
import { interactions } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PostCard } from "@/components/feed/PostCard";
import { Bookmark } from "lucide-react";
import { redirect } from "next/navigation";

export default function BookmarksPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => interactions.getBookmarks().then(r => r.data),
    enabled: isAuthenticated,
  });

  if (!authLoading && !isAuthenticated) {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <Bookmark className="w-5 h-5" />
        <h1 className="text-2xl font-bold">Bookmarks</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card p-6 h-32 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {(data?.data ?? []).map((post: any) => (
            <PostCard key={post.postId} post={post} />
          ))}
          {data?.data?.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-lg mb-1">No bookmarks yet</p>
              <p className="text-sm">Save stories to read later by clicking the bookmark icon.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
