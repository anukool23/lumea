import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeDate, readingTime, truncate } from "@/lib/utils";
import type { Post } from "@/lib/api";

interface PostCardProps {
  post: Post;
  featured?: boolean;
}

export function PostCard({ post, featured = false }: PostCardProps) {
  const href = `/${post.author.username}/${post.slug}`;

  if (featured) {
    return (
      <article className="group relative grid sm:grid-cols-2 gap-6 items-center">
        {post.coverImage && (
          <Link href={href} className="overflow-hidden rounded-xl aspect-[16/9] relative block bg-muted">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 50vw"
              priority
            />
          </Link>
        )}
        <div className="flex flex-col gap-3">
          {post.tags?.[0] && (
            <Badge variant="secondary" className="w-fit text-xs">
              {post.tags[0]}
            </Badge>
          )}
          <Link href={href}>
            <h2 className="text-2xl font-semibold tracking-tight leading-snug hover:text-muted-foreground transition-colors line-clamp-3">
              {post.title}
            </h2>
          </Link>
          {post.excerpt && (
            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
              {post.excerpt}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Link href={`/u/${post.author.username}`}>
              <Avatar className="h-6 w-6">
                <AvatarImage src={post.author.avatar} alt={post.author.name} />
                <AvatarFallback className="text-xs">
                  {post.author.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Link
              href={`/u/${post.author.username}`}
              className="text-sm font-medium hover:underline"
            >
              {post.author.name}
            </Link>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">
              {formatRelativeDate(post.publishedAt)}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">
              {readingTime(post.content ?? post.excerpt ?? "")}
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col gap-3">
      {post.coverImage && (
        <Link
          href={href}
          className="overflow-hidden rounded-lg aspect-[16/9] relative block bg-muted"
        >
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </Link>
      )}

      <div className="flex flex-col gap-2">
        {post.tags?.[0] && (
          <Link href={`/search?tag=${post.tags[0]}`}>
            <Badge variant="secondary" className="w-fit text-xs hover:bg-secondary/60 transition-colors">
              {post.tags[0]}
            </Badge>
          </Link>
        )}

        <Link href={href}>
          <h3 className="font-semibold leading-snug tracking-tight hover:text-muted-foreground transition-colors line-clamp-2">
            {post.title}
          </h3>
        </Link>

        {post.excerpt && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {truncate(post.excerpt, 120)}
          </p>
        )}

        <div className="flex items-center gap-2 mt-auto pt-1">
          <Link href={`/u/${post.author.username}`} className="shrink-0">
            <Avatar className="h-5 w-5">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback className="text-xs">
                {post.author.name?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <Link
            href={`/u/${post.author.username}`}
            className="text-xs font-medium hover:underline truncate"
          >
            {post.author.name}
          </Link>
          <span className="text-muted-foreground text-xs shrink-0">·</span>
          <span className="text-muted-foreground text-xs shrink-0">
            {formatRelativeDate(post.publishedAt)}
          </span>
          <span className="text-muted-foreground text-xs shrink-0">·</span>
          <span className="text-muted-foreground text-xs shrink-0">
            {readingTime(post.content ?? post.excerpt ?? "")}
          </span>
        </div>
      </div>
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="aspect-[16/9] rounded-lg bg-muted" />
      <div className="h-3 w-16 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-full bg-muted" />
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
      </div>
    </div>
  );
}
