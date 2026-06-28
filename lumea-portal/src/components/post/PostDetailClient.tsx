"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { content, interactions, ai } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PremiumGate } from "./PremiumGate";
import { PostActions } from "./PostActions";
import { CommentSection } from "./CommentSection";
import { RelatedPosts } from "./RelatedPosts";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Headphones, Sparkles, BookOpen } from "lucide-react";

interface Props { username: string; slug: string; }

export function PostDetailClient({ username, slug }: Props) {
  const { user, isAuthenticated } = useAuthStore();
  const [summary, setSummary] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [theme, setTheme] = useState<"default" | "sepia">("default");

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["post", username, slug],
    queryFn: () => content.getPostBySlug(slug, username).then(r => r.data),
  });

  // Record view
  useEffect(() => {
    if (post?.postId) {
      interactions.recordView(post.postId).catch(() => {});
    }
  }, [post?.postId]);

  // Summarize
  const summarizeMutation = useMutation({
    mutationFn: () => ai.summarize(post?.content ?? ""),
    onSuccess: (res) => { setSummary(res.data.summary); setShowSummary(true); },
  });

  // Text-to-speech
  const handleListen = () => {
    if (!post?.content) return;
    const text = post.content.replace(/<[^>]+>/g, " ");
    const utterance = new SpeechSynthesisUtterance(text);
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
    } else {
      utterance.onend = () => setIsReading(false);
      window.speechSynthesis.speak(utterance);
      setIsReading(true);
    }
  };

  if (isLoading) return <PostDetailSkeleton />;
  if (error || !post) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-2">Story not found</h1>
      <Link href="/" className="text-zinc-500 hover:underline">Back to home</Link>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors ${theme === "sepia" ? "theme-sepia" : ""}`}>
      <article className="max-w-2xl mx-auto px-4 py-8">
        {/* Cover image */}
        {post.coverImage && (
          <div className="w-full aspect-video rounded-xl overflow-hidden mb-8">
            <Image src={post.coverImage} alt={post.title} width={768} height={432} className="object-cover w-full h-full" priority />
          </div>
        )}

        {/* Header */}
        <header className="mb-8">
          {post.category && (
            <Link href={`/?category=${post.category}`} className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 block hover:text-zinc-600">
              {post.category}
            </Link>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">{post.title}</h1>
          <p className="text-zinc-500 text-lg leading-relaxed mb-6">{post.excerpt}</p>

          {/* Author + meta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/u/${post.authorUsername}`}>
                {post.authorPicture ? (
                  <Image src={post.authorPicture} alt={post.authorName} width={40} height={40} className="rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-medium">
                    {post.authorName?.[0]}
                  </div>
                )}
              </Link>
              <div>
                <Link href={`/u/${post.authorUsername}`} className="text-sm font-medium hover:underline">{post.authorName}</Link>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })}</span>
                  <span>·</span>
                  <span>{post.readingTimeMin} min read</span>
                </div>
              </div>
            </div>

            {/* Reading tools */}
            <div className="flex items-center gap-2">
              <button onClick={handleListen}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${isReading ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-300 hover:bg-zinc-50"}`}>
                <Headphones className="w-3.5 h-3.5" />
                {isReading ? "Stop" : "Listen"}
              </button>
              <button onClick={() => summarizeMutation.mutate()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-zinc-300 hover:bg-zinc-50 transition-colors"
                disabled={summarizeMutation.isPending}>
                <Sparkles className="w-3.5 h-3.5" />
                {summarizeMutation.isPending ? "..." : "Summary"}
              </button>
              <button onClick={() => setTheme(t => t === "default" ? "sepia" : "default")}
                className="p-1.5 rounded-full border border-zinc-300 hover:bg-zinc-50 transition-colors" title="Toggle reading theme">
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* AI Summary modal */}
        {showSummary && summary && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" /> AI Summary</h3>
              <button onClick={() => setShowSummary(false)} className="text-xs text-zinc-400 hover:text-zinc-600">Dismiss</button>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">{summary}</p>
          </div>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {post.tags.map((tag: string) => (
              <Link key={tag} href={`/?tag=${tag}`} className="text-xs px-3 py-1.5 bg-zinc-100 rounded-full hover:bg-zinc-200 text-zinc-600">
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Content */}
        {post.isGated ? (
          <PremiumGate authorUsername={post.authorUsername} previewContent={post.content ?? ""} />
        ) : (
          <div
            className="prose-lumea"
            dangerouslySetInnerHTML={{ __html: post.content ?? "" }}
          />
        )}

        {/* Post actions (like, bookmark, share) */}
        {!post.isGated && (
          <div className="mt-12 pt-8 border-t border-zinc-200">
            <PostActions post={post} />
          </div>
        )}

        {/* Comments */}
        <div className="mt-12">
          <CommentSection postId={post.postId} />
        </div>
      </article>

      {/* Related posts */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <RelatedPosts postId={post.postId} />
      </div>
    </div>
  );
}

function PostDetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse">
      <div className="w-full aspect-video bg-zinc-200 rounded-xl mb-8" />
      <div className="h-10 bg-zinc-200 rounded w-3/4 mb-4" />
      <div className="h-5 bg-zinc-200 rounded w-full mb-2" />
      <div className="h-5 bg-zinc-200 rounded w-2/3 mb-8" />
      {[...Array(8)].map((_, i) => <div key={i} className="h-4 bg-zinc-200 rounded w-full mb-3" />)}
    </div>
  );
}
