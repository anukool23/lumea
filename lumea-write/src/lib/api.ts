export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  tags?: string[];
  status: "draft" | "published" | "scheduled";
  publishedAt: string;
  scheduledAt?: string;
  updatedAt: string;
  views?: number;
  likesCount?: number;
  commentsCount?: number;
  metaTitle?: string;
  metaDescription?: string;
}

export interface PostsPage {
  posts: Post[];
  nextCursor?: string;
}

const BASE = "/api/proxy";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    req<{ user: any; token: string }>("/auth/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (form: { name: string; username: string; email: string; password: string }) =>
    req<{ user: any; token: string }>("/auth/api/auth/register", {
      method: "POST",
      body: JSON.stringify(form),
    }),

  // Posts
  getPosts: (params?: { status?: string; search?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    if (params?.limit)  q.set("limit",  String(params.limit));
    return req<PostsPage>(`/posts/api/posts?${q}`);
  },

  getPost: (id: string) => req<Post>(`/posts/api/posts/${id}`),

  createPost: (data: object) =>
    req<Post>("/posts/api/posts", { method: "POST", body: JSON.stringify(data) }),

  updatePost: (id: string, data: object) =>
    req<Post>(`/posts/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deletePost: (id: string) =>
    req(`/posts/api/posts/${id}`, { method: "DELETE" }),

  // Analytics
  getDashboardStats: () =>
    req<{
      totalViews: number; totalLikes: number; totalComments: number; followers: number;
      viewsChange: number; likesChange: number; commentsChange: number; followersChange: number;
    }>("/analytics/api/analytics/overview"),

  getPostAnalytics: (postId: string) =>
    req(`/analytics/api/analytics/posts/${postId}`),

  // AI
  aiGenerateIdeas: (data: { topic?: string; interests: string[]; existing_titles: string[] }) =>
    req<{ ideas: any[] }>("/ai/api/ai/generate-ideas", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  aiSEO: (data: { title: string; content: string; tags: string[]; excerpt: string }) =>
    req("/ai/api/ai/seo-analysis", { method: "POST", body: JSON.stringify(data) }),

  aiSummarize: (data: { content: string; max_length?: number }) =>
    req<{ summary: string }>("/ai/api/ai/summarize", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Notifications
  getNotifications: (params?: { page?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    return req(`/notifications/api/notifications?${q}`);
  },

  markNotificationRead: (id: string) =>
    req(`/notifications/api/notifications/${id}/read`, { method: "PATCH" }),

  markAllRead: () =>
    req("/notifications/api/notifications/read-all", { method: "PATCH" }),
};
