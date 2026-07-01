import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PostActions } from "@/components/post/PostActions";
import { CommentSection } from "@/components/post/CommentSection";
import { formatDate, readingTime } from "@/lib/utils";
import { serverApi } from "@/lib/api";

type Params = { username: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  try {
    const post = await serverApi.getPost(username, slug);
    return {
      title: post.title,
      description: post.excerpt,
      openGraph: {
        title: post.title,
        description: post.excerpt,
        images: post.coverImage ? [{ url: post.coverImage }] : [],
        type: "article",
        publishedTime: post.publishedAt,
        authors: [post.author.name],
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description: post.excerpt,
        images: post.coverImage ? [post.coverImage] : [],
      },
    };
  } catch {
    return {};
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username, slug } = await params;
  const post = await serverApi.getPost(username, slug).catch(() => null);

  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {post.tags.map((tag: string) => (
            <Link key={tag} href={`/search?tag=${tag}`}>
              <Badge variant="secondary" className="text-xs hover:bg-secondary/60 transition-colors">
                {tag}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-snug mb-4">
        {post.title}
      </h1>

      {/* Excerpt */}
      {post.excerpt && (
        <p className="text-lg text-muted-foreground leading-relaxed mb-6">
          {post.excerpt}
        </p>
      )}

      {/* Author + meta */}
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/u/${username}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatar} alt={post.author.name} />
            <AvatarFallback>{post.author.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div>
          <Link
            href={`/u/${username}`}
            className="text-sm font-medium hover:underline block"
          >
            {post.author.name}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatDate(post.publishedAt)}</span>
            <span>·</span>
            <span>{readingTime(post.content)}</span>
          </div>
        </div>

        {/* Actions (like, bookmark, share) */}
        <div className="ml-auto">
          <PostActions postId={post.id} initialLikes={post.likesCount ?? 0} />
        </div>
      </div>

      {/* Cover image */}
      {post.coverImage && (
        <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-10 bg-muted">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      {/* Content */}
      <div
        className="prose prose-zinc max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <Separator className="my-10" />

      {/* Author card */}
      <div className="flex gap-4 items-start p-5 rounded-xl bg-muted/50 border border-border/60">
        <Link href={`/u/${username}`}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={post.author.avatar} alt={post.author.name} />
            <AvatarFallback>{post.author.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/u/${username}`} className="font-semibold hover:underline">
            {post.author.name}
          </Link>
          {post.author.bio && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {post.author.bio}
            </p>
          )}
        </div>
      </div>

      <Separator className="my-10" />

      {/* Comments */}
      <CommentSection postId={post.id} />
    </article>
  );
}
