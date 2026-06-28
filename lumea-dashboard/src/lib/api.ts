/**
 * All API calls go through the BFF proxy at /api/proxy/[service]/...
 * Actual backend URLs and X-API-Key are server-side only — not visible in browser.
 */
import axios from "axios";

const AUTH    = "/api/proxy/auth-svc";
const POST    = "/api/proxy/post-svc";
const ANALYTICS = "/api/proxy/analytics-svc";
const AI      = "/api/proxy/ai-svc";
const MEDIA   = "/api/proxy/media-svc";

function makeClient(baseURL: string) {
  const client = axios.create({ baseURL });
  client.interceptors.request.use((config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("lumea_token") : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  client.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err.response?.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("lumea_token");
        window.location.href = "/login";
      }
      return Promise.reject(err);
    }
  );
  return client;
}

const authClient      = makeClient(AUTH);
const postClient      = makeClient(POST);
const analyticsClient = makeClient(ANALYTICS);
const aiClient        = makeClient(AI);
const mediaClient     = makeClient(MEDIA);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) => authClient.post("/auth/login", data),
  me: () => authClient.get("/auth/me"),
  logout: () => authClient.post("/auth/logout"),
  updateProfile: (data: any) => authClient.put("/users/profile", data),
  updateAvatar: (url: string) => authClient.patch("/users/profile/avatar", { profile_picture: url }),
};

// ── Posts ─────────────────────────────────────────────────────────────────────
export const postApi = {
  list: (params?: any) => postClient.get("/posts/my", { params }),
  stats: () => postClient.get("/posts/stats"),
  get: (postId: string) => postClient.get(`/posts/${postId}`),
  create: (data: any) => postClient.post("/posts", data),
  update: (postId: string, data: any) => postClient.put(`/posts/${postId}`, data),
  delete: (postId: string) => postClient.delete(`/posts/${postId}`),
  publish: (postId: string, scheduledAt?: string) =>
    postClient.post(`/posts/${postId}/publish`, { scheduledAt }),
  unpublish: (postId: string) => postClient.post(`/posts/${postId}/unpublish`),
  togglePremium: (postId: string) => postClient.patch(`/posts/${postId}/premium`),
  updateCover: (postId: string, coverImage: string) =>
    postClient.patch(`/posts/${postId}/cover`, { coverImage }),
  archive: (postId: string) => postClient.patch(`/posts/${postId}/archive`),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: (period = "30d") =>
    analyticsClient.get("/analytics/overview", { params: { period } }),
  posts: (period = "30d") =>
    analyticsClient.get("/analytics/posts", { params: { period } }),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  generateIdeas: (data: { topic?: string; interests?: string[]; existing_titles?: string[] }) =>
    aiClient.post("/ai/generate-ideas", data),
  seoAnalysis: (data: { title: string; content: string; tags?: string[]; excerpt?: string }) =>
    aiClient.post("/ai/seo-analysis", data),
  summarize: (content: string) => aiClient.post("/ai/summarize", { content }),
  usage: () => aiClient.get("/ai/usage"),
};

// ── Media ─────────────────────────────────────────────────────────────────────
export const mediaApi = {
  getUploadUrl: (folder: string) => mediaClient.post("/media/upload-url", { folder }),
  deleteMedia: (publicId: string) =>
    mediaClient.delete(`/media/${encodeURIComponent(publicId)}`),
};
