"use client";
import { useState } from "react";
import { Heart, Bookmark, Share2, MessageCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { interactions } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

interface Props {
  post: { postId: string; likeCount: number; commentCount: number };
}

export function PostActions({ post }: Props) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: likeStatus } = useQuery({
    queryKey: ["like-status", post.postId],
    queryFn: () => interactions.getLikeStatus(post.postId).then(r => r.data),
    enabled: isAuthenticated,
  });

  const likeMutation = useMutation({
    mutationFn: () =>
      likeStatus?.liked ? interactions.unlikePost(post.postId) : interactions.likePost(post.postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["like-status", post.postId] }),
  });

  const handleLike = () => {
    if (!isAuthenticated) { router.push("/login"); return; }
    likeMutation.mutate();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="flex items-center gap-6">
      <button
        onClick={handleLike}
        className={`flex items-center gap-2 text-sm transition-colors ${likeStatus?.liked ? "text-red-500" : "text-zinc-400 hover:text-red-500"}`}
      >
        <Heart className={`w-5 h-5 ${likeStatus?.liked ? "fill-current" : ""}`} />
        <span>{likeStatus?.count ?? post.likeCount}</span>
      </button>

      <button className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-700 transition-colors">
        <MessageCircle className="w-5 h-5" />
        <span>{post.commentCount}</span>
      </button>

      <button
        onClick={handleShare}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-700 transition-colors ml-auto"
      >
        <Share2 className="w-4 h-4" />
        <span>{copied ? "Copied!" : "Share"}</span>
      </button>
    </div>
  );
}
