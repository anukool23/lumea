/**
 * All API calls go through the BFF proxy at /api/proxy/[service]/...
 * Backend URLs and X-API-Key are never exposed to the browser.
 */
import axios from "axios";

// ── BFF base URLs (relative — same origin as the Next.js app) ─────────────────
const AUTH    = "/api/proxy/auth-svc";
const CONTENT = "/api/proxy/content-svc";
const POST    = "/api/proxy/post-svc";
const IACT    = "/api/proxy/interaction-svc";
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

const authApi        = makeClient(AUTH);
const contentApi     = makeClient(CONTENT);
const interactionApi = makeClient(IACT);
const aiApi          = makeClient(AI);
const mediaApiClient = makeClient(MEDIA);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  register: (data: { email: string; password: string; first_name: string; last_name: string; username: string }) =>
    authApi.post("/auth/register", data),
  verifyOTP: (data: { email: string; otp: string }) => authApi.post("/auth/verify-otp", data),
  resendOTP: (email: string) => authApi.post("/auth/resend-otp", { email }),
  login: (data: { email: string; password: string }) => authApi.post("/auth/login", data),
  logout: () => authApi.post("/auth/logout"),
  me: () => authApi.get("/auth/me"),
  forgotPassword: (email: string) => authApi.post("/auth/forgot-password", { email }),
  resetPassword: (data: { token: string; new_password: string }) => authApi.post("/auth/reset-password", data),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = {
  getProfile: () => authApi.get("/users/profile"),
  updateProfile: (data: any) => authApi.put("/users/profile", data),
  updateAvatar: (url: string) => authApi.patch("/users/profile/avatar", { profile_picture: url }),
  getPublicProfile: (handle: string) => authApi.get(`/users/${handle}`),
  follow: (userId: string) => authApi.post(`/users/${userId}/follow`),
  unfollow: (userId: string) => authApi.delete(`/users/${userId}/follow`),
  getSuggested: () => authApi.get("/users/suggested"),
  getFollowers: (userId: string, page = 1) => authApi.get(`/users/${userId}/followers?page=${page}`),
  getFollowing: (userId: string, page = 1) => authApi.get(`/users/${userId}/following?page=${page}`),
};

// ── Content (public read) ─────────────────────────────────────────────────────
export const content = {
  getFeed: (params?: { type?: string; page?: number; limit?: number; category?: string; tag?: string }) =>
    contentApi.get("/feed", { params }),
  getTrending: (page = 1) => contentApi.get("/feed/trending", { params: { page } }),
  getFollowingFeed: (page = 1) => contentApi.get("/feed/following", { params: { page } }),
  getPopularTags: () => contentApi.get("/feed/tags"),
  getPost: (postId: string) => contentApi.get(`/posts/${postId}`),
  getPostBySlug: (slug: string, author?: string) =>
    contentApi.get(`/posts/by-slug/${slug}`, { params: { author } }),
  getRelated: (postId: string) => contentApi.get(`/posts/${postId}/related`),
  getAuthorPosts: (username: string, page = 1) =>
    contentApi.get(`/users/${username}/posts`, { params: { page } }),
  search: (q: string, params?: any) => contentApi.get("/search", { params: { q, ...params } }),
  suggest: (q: string) => contentApi.get("/search/suggest", { params: { q } }),
};

// ── Interactions ──────────────────────────────────────────────────────────────
export const interactions = {
  likePost: (postId: string) => interactionApi.post(`/posts/${postId}/like`),
  unlikePost: (postId: string) => interactionApi.delete(`/posts/${postId}/like`),
  getLikeStatus: (postId: string) => interactionApi.get(`/posts/${postId}/like`),
  getComments: (postId: string, page = 1) =>
    interactionApi.get(`/posts/${postId}/comments`, { params: { page } }),
  addComment: (postId: string, content: string, parentId?: string) =>
    interactionApi.post(`/posts/${postId}/comments`, { content, parentId }),
  deleteComment: (commentId: string) => interactionApi.delete(`/comments/${commentId}`),
  bookmark: (postId: string) => interactionApi.post(`/posts/${postId}/bookmark`),
  unbookmark: (postId: string) => interactionApi.delete(`/posts/${postId}/bookmark`),
  getBookmarks: (page = 1) => interactionApi.get("/users/bookmarks", { params: { page } }),
  recordView: (postId: string) => interactionApi.post(`/posts/${postId}/view`),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const ai = {
  summarize: (content: string) => aiApi.post("/ai/summarize", { content }),
  getUsage: () => aiApi.get("/ai/usage"),
};
