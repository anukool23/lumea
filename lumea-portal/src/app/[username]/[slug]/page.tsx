import { Metadata } from "next";
import { PostDetailClient } from "@/components/post/PostDetailClient";

interface Props {
  params: { username: string; slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const CONTENT_URL = process.env.NEXT_PUBLIC_CONTENT_API_URL ?? "http://localhost:8788";
  try {
    const res = await fetch(`${CONTENT_URL}/api/posts/by-slug/${params.slug}?author=${params.username}`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: "Story not found" };
    const post = await res.json();
    return {
      title: post.title,
      description: post.excerpt,
      openGraph: {
        title: post.title,
        description: post.excerpt,
        images: post.coverImage ? [{ url: post.coverImage }] : [],
        type: "article",
        authors: [post.authorName],
      },
    };
  } catch {
    return { title: "Story" };
  }
}

export default function PostPage({ params }: Props) {
  return <PostDetailClient username={params.username} slug={params.slug} />;
}
