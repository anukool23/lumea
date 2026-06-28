"use client";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, BookmarkPlus, Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Post {
  postId: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorPicture?: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string;
  tags: string[];
  category?: string;
  isPremium: boolean;
  isGated?: boolean;
  readingTimeMin: number;
  likeCount: number;
  viewCount: number;
  commentCount: number;
  publishedAt: string;
}

interface PostCardProps {
  post: Post;
  variant?: "default" | "compact";
}

export function PostCard({ post, variant = "default" }: PostCardProps) {
  const href = `/${post.authorUsername}/${post.slug}`;

  if (variant === "compact") {
    return (
      <article className="flex gap-4 py-4 border-b border-zinc-100 last:border-0">
        <div className="flex-1 min-w-0">
          <Link href={`/u/${post.authorUsername}`} className="flex items-center gap-2 mb-2">
            <Avatar src={post.authorPicture} name={post.authorName} size={20} />
            <span className="text-xs text-zinc-500">{post.authorName}</span>
          </Link>
          <Link href={href}>
            <h3 className="font-semibold text-sm line-clamp-2 hover:underline">{post.title}</h3>
          </Link>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
            <span>{post.readingTimeMin} min read</span>
            {post.isPremium && <Lock className="w-3 h-3 text-amber-500" />}
          </div>
        </div>
        {post.coverImage && (
          <Link href={href} className="shrink-0 w-20 h-16 rounded-lg overflow-hidden">
            <Image src={post.coverImage} alt={post.title} width={80} height={64} className="object-cover w-full h-full" />
          </Link>
        )}
      </article>
    );
  }

  return (
    <article className="card p-6 hover:shadow-sm transition-shadow">
      {/* Author */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/u/${post.authorUsername}`} className="flex items-center gap-2">
          <Avatar src={post.authorPicture} name={post.authorName} size={32} />
          <div>
            <p className="text-sm font-medium">{post.authorName}</p>
            <p className="text-xs text-zinc-400">@{post.authorUsername}</p>
          </div>
        </Link>
        <span className="text-xs text-zinc-400">
          {formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })}
        </span>
      </div>

      <div className="flex gap-4">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link href={href}>
            <h2 className="text-xl font-bold mb-2 hover:underline line-clamp-2 leading-tight">
              {post.isPremium && <Lock className="inline w-4 h-4 text-amber-500 mr-1 mb-0.5" />}
              {post.title}
            </h2>
            <p className="text-zinc-500 text-sm line-clamp-2 leading-relaxed">{post.excerpt}</p>
          </Link>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.tags.slice(0, 3).map(tag => (
                <Link key={tag} href={`/?tag=${tag}`}
                  className="text-xs px-2.5 py-1 bg-zinc-100 rounded-full hover:bg-zinc-200 text-zinc-600 transition-colors">
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 mt-4 text-xs text-zinc-400">
            <span>{post.readingTimeMin} min read</span>
            <div className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.viewCount}</div>
            <div className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{post.likeCount}</div>
            <div className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{post.commentCount}</div>
            <button className="ml-auto hover:text-zinc-700"><BookmarkPlus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Cover image */}
        {post.coverImage && (
          <Link href={href} className="shrink-0 w-32 h-24 rounded-lg overflow-hidden hidden sm:block">
            <Image src={post.coverImage} alt={post.title} width={128} height={96} className="object-cover w-full h-full" />
          </Link>
        )}
      </div>
    </article>
  );
}

function Avatar({ src, name, size }: { src?: string; name: string; size: number }) {
  if (src) return <Image src={src} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-full bg-zinc-200 flex items-center justify-center font-medium text-zinc-600"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}
