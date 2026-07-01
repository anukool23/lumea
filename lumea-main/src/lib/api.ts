/** Shared types */
export interface Author {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio?: string;
  coverImage?: string;
  tags?: string[];
  followersCount?: number;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  tags?: string[];
  author: Author;
  publishedAt: string;
  likesCount?: number;
  commentsCount?: number;
}

export interface PostsPage {
  posts: Post[];
  nextCursor?: string;
}

/** Client-side API — routes through the BFF proxy */
const BASE = "/api/proxy";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  getPosts: (params?: { topic?: string; cursor?: string }) => {
    const q = new URLSearchParams();
    if (params?.topic) q.set("topic", params.topic);
    if (params?.cursor) q.set("cursor", params.cursor);
    return req<PostsPage>(`/posts/api/posts?${q}`);
  },

  getPost: (username: string, slug: string) =>
    req<Post>(`/posts/api/posts/${username}/${slug}`),

  getAuthor: (username: string) =>
    req<Author>(`/auth/api/users/${username}`),

  getAuthorPosts: (username: string) =>
    req<Post[]>(`/posts/api/posts?author=${username}`),

  searchPosts: (params: {
    q?: string;
    tag?: string;
    from?: string;
    to?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.q)    q.set("q", params.q);
    if (params.tag)  q.set("tag", params.tag);
    if (params.from) q.set("from", params.from);
    if (params.to)   q.set("to", params.to);
    return req<PostsPage>(`/content/api/search?${q}`);
  },

  getComments: (postId: string) =>
    req<any[]>(`/interactions/api/comments?postId=${postId}`),

  addComment: (postId: string, body: string) =>
    req(`/interactions/api/comments`, {
      method: "POST",
      body: JSON.stringify({ postId, body }),
    }),

  toggleLike: (postId: string) =>
    req(`/interactions/api/likes/${postId}`, { method: "POST" }),

  toggleBookmark: (postId: string) =>
    req(`/interactions/api/bookmarks/${postId}`, { method: "POST" }),

  getBookmarks: () =>
    req<PostsPage>(`/interactions/api/bookmarks`),
};

/** Server-side API — calls backends directly (no BFF overhead) */
const serverBase = (service: string) =>
  ({
    posts:        process.env.POST_API_URL,
    auth:         process.env.AUTH_API_URL,
    content:      process.env.CONTENT_API_URL,
    interactions: process.env.INTERACTION_API_URL,
  })[service] ?? "";

async function serverReq<T>(service: string, path: string): Promise<T> {
  const url = `${serverBase(service)}${path}`;
  const res = await fetch(url, {
    headers: { "x-api-key": process.env.API_KEY ?? "" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`[serverApi] ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const serverApi = {
  getPost: (username: string, slug: string) =>
    serverReq<Post>("posts", `/api/posts/${username}/${slug}`),

  getAuthor: (username: string) =>
    serverReq<Author>("auth", `/api/users/${username}`),

  getAuthorPosts: (username: string) =>
    serverReq<Post[]>("posts", `/api/posts?author=${username}`),
};
