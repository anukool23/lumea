"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { interactions } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Comment {
  _id: string; content: string; authorId: string; authorUsername: string;
  authorName: string; authorPicture?: string; createdAt: string; parentId?: string;
}

export function CommentSection({ postId }: { postId: string }) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => interactions.getComments(postId).then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () => interactions.addComment(postId, text, replyTo ?? undefined),
    onSuccess: () => { setText(""); setReplyTo(null); qc.invalidateQueries({ queryKey: ["comments", postId] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => interactions.deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", postId] }),
  });

  const comments: Comment[] = data?.data ?? [];
  const topLevel = comments.filter(c => !c.parentId);
  const replies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) { router.push("/login"); return; }
    if (!text.trim()) return;
    addMutation.mutate();
  };

  return (
    <div>
      <h3 className="font-semibold text-lg mb-6">{comments.length} Comments</h3>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
        <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 text-xs font-medium">
          {user?.username?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
              Replying to a comment
              <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-zinc-700">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isAuthenticated ? "Add a comment..." : "Sign in to comment"}
              className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              disabled={!isAuthenticated}
            />
            <button type="submit" disabled={!text.trim() || addMutation.isPending} className="btn-primary py-2">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-zinc-200 shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-zinc-200 rounded w-24 mb-2" />
                <div className="h-4 bg-zinc-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {topLevel.map(comment => (
            <div key={comment._id}>
              <CommentItem
                comment={comment}
                currentUserId={user?.id}
                onReply={() => setReplyTo(comment._id)}
                onDelete={() => deleteMutation.mutate(comment._id)}
              />
              {/* Replies */}
              <div className="ml-11 mt-3 space-y-3">
                {replies(comment._id).map(reply => (
                  <CommentItem
                    key={reply._id}
                    comment={reply}
                    currentUserId={user?.id}
                    onDelete={() => deleteMutation.mutate(reply._id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment, currentUserId, onReply, onDelete }: {
  comment: Comment; currentUserId?: string;
  onReply?: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-zinc-200 shrink-0 flex items-center justify-center text-xs font-medium overflow-hidden">
        {comment.authorPicture ? (
          <Image src={comment.authorPicture} alt={comment.authorName} width={32} height={32} className="object-cover" />
        ) : comment.authorUsername?.[0]?.toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{comment.authorName}</span>
          <span className="text-xs text-zinc-400">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-zinc-700 mt-1 leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-3 mt-1">
          {onReply && (
            <button onClick={onReply} className="text-xs text-zinc-400 hover:text-zinc-600">Reply</button>
          )}
          {comment.authorId === currentUserId && (
            <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
