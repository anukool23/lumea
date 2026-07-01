"use client";

import { useState } from "react";
import { Heart, Bookmark, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PostActionsProps {
  postId: string;
  initialLikes: number;
}

export function PostActions({ postId, initialLikes }: PostActionsProps) {
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);

  async function handleLike() {
    if (!user) return;
    setLiked((v) => !v);
    setLikes((v) => (liked ? v - 1 : v + 1));
    await api.toggleLike(postId).catch(() => {
      setLiked((v) => !v);
      setLikes((v) => (liked ? v + 1 : v - 1));
    });
  }

  async function handleBookmark() {
    if (!user) return;
    setBookmarked((v) => !v);
    await api.toggleBookmark(postId).catch(() => setBookmarked((v) => !v));
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: document.title, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8 gap-1.5 text-xs", liked && "text-red-500")}
        onClick={handleLike}
        aria-label="Like post"
      >
        <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
        {likes > 0 && <span>{likes}</span>}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", bookmarked && "text-foreground")}
        onClick={handleBookmark}
        aria-label="Bookmark post"
      >
        <Bookmark className={cn("h-3.5 w-3.5", bookmarked && "fill-current")} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleShare}
        aria-label="Share post"
      >
        <Share2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
