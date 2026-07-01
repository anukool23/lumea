import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PostCard } from "@/components/feed/PostCard";
import { serverApi } from "@/lib/api";

type Params = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username } = await params;
  try {
    const author = await serverApi.getAuthor(username);
    return {
      title: `${author.name} (@${username})`,
      description: author.bio,
      openGraph: {
        images: author.avatar ? [{ url: author.avatar }] : [],
      },
    };
  } catch {
    return {};
  }
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username } = await params;
  const [author, posts] = await Promise.all([
    serverApi.getAuthor(username).catch(() => null),
    serverApi.getAuthorPosts(username).catch(() => []),
  ]);

  if (!author) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
      {/* Cover image */}
      {author.coverImage && (
        <div className="relative aspect-[3/1] rounded-xl overflow-hidden mb-8 bg-muted -mx-4 sm:mx-0">
          <Image src={author.coverImage} alt="" fill className="object-cover" />
        </div>
      )}

      {/* Author info */}
      <div className="flex items-start gap-4 mb-8">
        <Avatar className="h-16 w-16 ring-2 ring-background">
          <AvatarImage src={author.avatar} alt={author.name} />
          <AvatarFallback className="text-lg">
            {author.name?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{author.name}</h1>
          <p className="text-muted-foreground text-sm">@{username}</p>
          {author.bio && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-lg">
              {author.bio}
            </p>
          )}
          <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{author.followersCount ?? 0}</strong> followers</span>
            <span><strong className="text-foreground">{posts.length}</strong> posts</span>
          </div>
        </div>
      </div>

      {author.tags && author.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-8">
          {author.tags.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Separator className="mb-8" />

      {/* Posts */}
      {posts.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">
          No posts published yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
