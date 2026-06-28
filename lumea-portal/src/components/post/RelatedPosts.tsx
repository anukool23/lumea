"use client";
import { useQuery } from "@tanstack/react-query";
import { content } from "@/lib/api";
import { PostCard } from "../feed/PostCard";

export function RelatedPosts({ postId }: { postId: string }) {
  const { data } = useQuery({
    queryKey: ["related", postId],
    queryFn: () => content.getRelated(postId).then(r => r.data),
  });

  const posts = data?.data ?? [];
  if (!posts.length) return null;

  return (
    <div className="mt-8 pt-8 border-t border-zinc-200">
      <h3 className="font-semibold text-lg mb-6">More stories</h3>
      <div className="space-y-4">
        {posts.slice(0, 3).map((post: any) => (
          <PostCard key={post.postId} post={post} variant="compact" />
        ))}
      </div>
    </div>
  );
}
