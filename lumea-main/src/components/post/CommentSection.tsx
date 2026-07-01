"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { formatRelativeDate } from "@/lib/utils";

interface CommentSectionProps {
  postId: string;
}

export function CommentSection({ postId }: CommentSectionProps) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => api.getComments(postId),
  });

  const addComment = useMutation({
    mutationFn: (text: string) => api.addComment(postId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      setBody("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim()) addComment.mutate(body.trim());
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-6">
        Responses {comments?.length ? `(${comments.length})` : ""}
      </h2>

      {/* Write a comment */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-8 flex gap-3">
          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="text-xs">
              {user.name?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex flex-col gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a response…"
              rows={3}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              size="sm"
              className="self-end h-8"
              disabled={!body.trim() || addComment.isPending}
            >
              {addComment.isPending ? "Posting…" : "Respond"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground mb-8">
          <a href="/login" className="text-foreground underline underline-offset-4">Sign in</a> to write a response.
        </p>
      )}

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : comments?.length ? (
        <div className="space-y-6">
          {comments.map((comment: any) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
                <AvatarFallback className="text-xs">
                  {comment.author.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{comment.author.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {comment.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No responses yet. Be the first.</p>
      )}
    </section>
  );
}
