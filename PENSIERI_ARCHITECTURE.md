# Pensieri — Architecture Context

**Version:** 1.0 | **Last Updated:** March 2026 | **Maintained by:** Piyush Kumar  
**Status:** Active Beta

---

## What Is Pensieri?

Pensieri (Italian: "thoughts") is a modern storytelling platform — a Medium/Substack hybrid built from scratch with no legacy debt. It merges a distraction-free writing experience with native AI tooling and a full monetization stack.

Each published piece is called a *pensiero* (singular). The platform's north star: writing that matters, not content that converts.

---

## System Architecture: The Big Picture

Pensieri is three codebases working together as a **decoupled, multi-service system**:

| Service | Tech | Hosting | Role |
|---|---|---|---|
| **Frontend** | Next.js 16 / React 19 / TypeScript | Cloudflare Pages (Edge Runtime) | Presentation + SSR |
| **Backend API** | Spring Boot 3.4 / Java 17 | Render (Docker container) | All business logic |
| **SMTP Microservice** | Node.js serverless | Vercel | Transactional email proxy |

**Supporting infrastructure:**

| Service | Provider | Role |
|---|---|---|
| Primary Database | MongoDB Atlas | All app data |
| Cache / Rate Limiting | Redis Cloud (Lettuce client) | Token blacklist, AI rate limits, OTP, AI response cache |
| Real-time Chat | Google Firebase (BaaS) | Chat messages (Firestore) + presence/typing (RTDB) |
| Media CDN | Cloudinary | Image/audio upload, on-the-fly transforms |
| AI Providers | Groq, OpenRouter, Cohere, Pollinations.ai | 15 AI writing features |
| Payments | Razorpay (India) + Buy Me a Coffee (global) | Donations + subscriptions |

---

## Presentation Layer (Next.js 16)

### Deployment
- Hosted on **Cloudflare Pages** using `@cloudflare/next-on-pages` adapter.
- Uses `export const runtime = 'edge'` on layouts/pages → runs from Cloudflare's global edge nodes, zero cold starts.

### Key Responsibilities
- SSR for blog posts (`/blog/[slug]`) — critical for SEO and OG metadata.
- Client-side rendering for interactive features (editor, dashboard, chat).
- Managing JWT in dual storage (localStorage + cookie).
- Directly connecting to Firebase SDK for real-time chat (no backend WebSocket).
- Pre-publication community guidelines scanning (client-side, for UX speed).

### Provider Nesting Order (`app/layout.tsx`)
The entire app is wrapped in this specific order (dependencies cascade down):
1. `<QueryProvider>` — TanStack Query for server state
2. `<ThemeProvider>` — CSS theme persistence
3. `<AuthProvider>` — JWT and login identity
4. `<BookmarkContext>` — depends on Auth to know DB vs. cookie mode
5. `<ChatContext>` — depends on Auth to init Firebase sockets
6. `<CallContext>` — depends on Chat identity

### Route Map

| Path | Rendering | Role |
|---|---|---|
| `/` | SSR | Home feed (Fresh Ink, Trending, Recommendations) |
| `/write` | CSR | Tiptap editor — requires auth |
| `/blog/[slug]` | SSR | Post reading page — SEO-critical |
| `/u/[handle]` | SSR | Public user profiles |
| `/dashboard` | CSR | Analytics charts and payouts |
| `/admin` | CSR | SPA moderation panel — requires ADMIN role |

### Edge Middleware (`middleware.ts`)
Runs on Cloudflare edge before React renders. Reads the `pensieri-auth-token` HTTP cookie:
- Unauthenticated users hitting `/write` or `/dashboard` → hard redirect to `/login`.
- Authenticated users hitting `/login` → redirect to `/`.
- Admin routes parse a separate `isAdminLoggedIn` cookie layer.

### Global Theming
- Three themes: `light`, `dark`, `reading` (sepia). Set via `data-theme` on `<html>`.
- CSS custom properties defined in `globals.css` (e.g., `var(--bg-primary)`).
- `readingIntensity` (0–100) applied via `root.style.setProperty("--reading-intensity", "X%")` for eye-strain control.
- Fonts: **Inter** (UI elements) + **Lora** (reading/writing content), loaded via `next/font/google`.

### API Client Layer
- The Spring Boot backend exposes **OpenAPI 3.0**. The frontend runs **Orval** (`npm run gen`) to auto-generate 148+ typed TanStack Query hooks and TypeScript interfaces.
- Never use raw `fetch()` or Axios directly in components — always use Orval-generated hooks.
- Custom Axios instance (`src/api/axios-instance.ts`):
  - **Request interceptor**: Injects `Authorization: Bearer <token>` from localStorage. Switches to `pensieri_admin_token` if URL contains `/admin`.
  - **Response interceptor**: On HTTP 401, purges local caches, fires toast error, redirects to `/login`.

### TanStack Query Caching
- `staleTime` memoizes aggressive queries (profiles, categories) in browser memory.
- `SyncStoragePersister` serializes cache to browser storage — powers PWA offline mode.

### Core React Contexts

**AuthContext:** `isLoggedIn` boolean, active `User` object, and `login` / `logout` / `deleteAccount` / `updateUser` methods. Cross-tab sync via storage event listeners.

**BookmarkContext:**
- Logged in → mutations save permanently to MongoDB via Orval.
- Guest → mutations save to `inkwise_bookmarks` browser cookie. On registration, backend sweeps the cookie and persists them permanently.

---

## Business Logic Layer (Spring Boot 3.4)

### Deployment
- Render as a self-contained Docker container.
- Multi-stage Dockerfile: build stage uses `maven:3.9.6-eclipse-temurin-17`, runtime stage uses `eclipse-temurin:17-jre-alpine`.
- Listens on port `8080`. Environment variables injected at runtime via Render; locally via `spring-dotenv`.
- Production base URL: `https://pensieri-blog-api.onrender.com/api`

### Key Responsibilities
- Authenticating all requests (JWT validation, Firebase token verification for Google OAuth).
- Role-based authorization (USER / EDITOR / ADMIN).
- All CRUD on posts, users, comments, bookmarks, notifications.
- AI orchestration (15 features, multi-provider load balancing + fallback chain).
- Donation processing (Razorpay + Buy Me a Coffee webhook verification).
- InkScore calculation and badge evaluation.
- Content moderation (OWASP HTML sanitization, bait-and-switch protection).
- Issuing Firebase custom tokens for chat identity.
- Sending emails via the SMTP microservice.

### Architectural Conventions (Controller → Service → Repository)
- Controllers handle HTTP boundaries and validation only.
- Services hold all business logic.
- Repositories handle data access.
- **DTOs**: Never expose `@Entity` models directly. Always map to response DTOs (e.g., `mapToPostFeedDto`) to prevent PII leakage.
- **OpenAPI**: Every controller method must have `@Operation` and `@ApiResponse` — the frontend's Orval codegen depends on this.

---

## SMTP Microservice (Node.js / Vercel)

**Why separate?** Render (and Heroku) block outbound SMTP ports 25, 465, 587. Rather than pay for SendGrid, a minimal Vercel serverless function proxies email through Gmail SMTP.

**Single endpoint:** `POST /api/send`

**Flow:**
1. Spring Boot sends HTTP POST to `https://pensieri-smtp-proxy.vercel.app/api/send` with `Authorization: Bearer <INTERNAL_SECRET>`.
2. Node.js worker receives `{ to, subject, html }`.
3. Nodemailer + Gmail App Password establishes the SMTP tunnel and sends.

**Security:** The microservice strictly validates the `INTERNAL_SECRET` bearer token before sending anything. A missing or wrong token returns `401 Unauthorized` without acknowledging the payload.

---

## Firebase (Real-time Layer)

Firebase is used **exclusively** for real-time chat. No post storage, no user profiles, no business logic.

| Firebase Service | Path / Usage |
|---|---|
| **Firestore** | `chats/{chatId}/messages` — durable message payloads |
| **Realtime Database (RTDB)** | `status/{handle}` — Online/Offline presence; `typing/{chatId}/{handle}` — typing indicators |
| **Firebase Auth** | Validates Google OAuth tokens; issues custom tokens for chat |

### Chat Authentication Bridge
1. User logs in normally via JWT.
2. Opening Chat triggers `POST /api/chat/token`.
3. Spring Boot Backend (via Firebase Admin SDK) mints a Custom Firebase Token linked to the user's Pensieri ID.
4. React client calls `signInWithCustomToken(token)`.

### Mutual Friendship Protection
You can only chat with users who follow you back. Chat IDs are deterministic: `[handle1, handle2].sort().join('_')` — both users hash to the same chat lobby with zero lookup collision.

### Firestore vs RTDB Separation
- **Firestore**: Durable message payloads (`authorId`, `text`, `createdAt`, `reactions`). Uses `onSnapshot()` for real-time delta updates.
- **RTDB**: Ephemeral states only. `onDisconnect()` handlers auto-set OFFLINE on tab close.

---

## Security Architecture

### Authentication

**JWT Token Lifecycle:**
- Generated exclusively by `AuthController`.
- Signed with HS256 using base64-encoded `JWT_SECRET`.
- Every protected endpoint validates `Authorization: Bearer <token>`.
- On logout: token ID is blacklisted in Redis with TTL matching remaining validity. This prevents replay attacks before the hard expiry.

**Dual Token Storage (frontend):**
- `localStorage` — for client-side JS reads (Axios interceptor, AuthContext, TanStack Query).
- HTTP Cookie (`pensieri-auth-token`) — for SSR/middleware on the Cloudflare Edge (middleware can't read localStorage).

**Registration & OTP Flow:**
1. User submits email/password.
2. Backend rate-limits via Redis (prevents brute-force email spam).
3. Backend saves OTP state to Redis and dispatches 6-digit code via SMTP microservice.
4. User validates code → Redis token wiped → account goes live.

**Google OAuth Flow:**
1. Frontend prompts Firebase SDK for Google sign-in.
2. Firebase returns an OAuth Token to the frontend.
3. Frontend sends token to Spring Boot.
4. Backend verifies via Firebase Admin SDK.
5. If valid, backend issues a native Pensieri JWT.

### Authorization (RBAC)

Three roles stored as Enum on the User document:
- `USER` — standard (create posts, like, comment, edit own profile).
- `EDITOR` — elevated view access, bypasses certain paywalls.
- `ADMIN` — unrestricted access including moderation, user strikes, system tooling.

**Spring Security (`SecurityConfig.java`):**
- Public routes: `/api/auth/**`, `/api/posts` (GET), webhooks.
- Protected routes: everything else (requires valid JWT).
- Admin routes: `/api/admin/**` enforces hard `.hasRole("ADMIN")` check.

**Admin Token Separation:** The frontend Axios config switches from `blog_token` to `pensieri_admin_token` on any URL containing `/admin`. Fails intentionally if the admin token is missing.

### Content Security

**Backend — OWASP HTML Sanitizer:** Before any post save hits MongoDB, the HTML payload is sanitized. Allows structural tags (`<p>`, `<h1>`, `<b>`, `<img src="...">`). Completely strips `<script>`, `onload`, `<iframe>`.

**Frontend — Community Guidelines Scanner:** Before publish, text is checked client-side against `communityGuidelines.json` (slurs + banned phrases regex). Violations halt publishing and highlight banned words directly in Tiptap.

**Bait-and-Switch Protection:** If a user edits an already-PUBLISHED post, the backend compares before/after HTML length and tag structure. Significant deviation demotes status back to `PENDING_REVIEW` while preserving the old content publicly.

### Payment Security

**Razorpay — HMAC-SHA256 Signature Verification:** When a transaction succeeds, Razorpay fires a webhook with `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. The backend uses `RAZORPAY_KEY_SECRET` to compute a matching HMAC-SHA256 hash. Only a perfect match unlocks the user's `SupporterTier`.

**Buy Me a Coffee:** Same pattern using `BMC_WEBHOOK_SECRET`.

---

## Data Models

### User Model (40+ fields)

**Core Identity:** `id`, `email`, `password` (BCrypt, null if OAuth), `username` (auto-generated `{firstName}Pensieri` or user-set), `name`/`firstName`/`lastName`, `profilePicture`/`coverImage` (Cloudinary URIs), `bio`/`tagline`, `authProvider` (LOCAL or GOOGLE), `role` (USER/EDITOR/ADMIN), `isVerified`/`emailVerified`.

**Gamification:** `inkScore` (Integer), `badges` (List — e.g., "Wordsmith", "Top 1%"), `followersCount`/`followingCount`, `followerIds`/`followingIds` (Set stored as arrays for O(1) mutual-follow lookups).

**Monetization:** `isPartner` (Boolean), `supporterStatus` (NONE/BRONZE/SILVER/GOLD/PLATINUM/LIFETIME), `supporterExpiryDate`, `earningsBalance` (Double, INR), `totalEarned`, `PayoutDetails` sub-document (`upiId`, `bankAccountNumber`, `ifscCode`, `accountHolderName`).

**Platform Restrictions:** `isBanned`, `strikes` (Integer, auto-ban at 3), `BlogQuota` sub-document (`postsPublishedThisMonth`, `lastPublishWindowStart`), `CommentingRestriction` sub-document (`isRestricted`, `restrictionEndTime`, `reason`).

**Metadata:** `interests` (List — for recommendation engine), `joinedAt`/`lastLoginAt`, `SocialProfiles` sub-document (twitter, github, linkedin, website).

### Post Model

**Core Content:** `id`, `title`, `slug` (unique, collision-safe), `content` (sanitized HTML), `excerpt`, `coverImage`/`coverImageCredit`, `status` (DRAFT / PENDING_REVIEW / PUBLISHED / REJECTED / ARCHIVED), `isPremium` (paywalled after excerpt), `category`, `tags` (List).

**Denormalized Author Snapshot:** To avoid `$lookup` on every feed query, the Post embeds `Author { id, name, username, profilePicture, bio }`. An async background repair job syncs snapshots when a user updates their profile.

**Engagement Metrics:** `viewCount`/`uniqueViewCount` (Long), `likeCount`/`commentCount`/`shareCount`/`bookmarkCount` (Integer), `readingTime` (Integer, avg 200 WPM), `score` (Double — trending decay score).

**SEO:** `metaTitle`/`metaDescription` (auto-extracted or explicit), `createdAt`/`updatedAt`/`publishedAt`, `rejectionReason`.

### Supporting Models

| Model | Purpose | Key Fields |
|---|---|---|
| `Comment` | Nested reply trees on posts | `postId`, `userId`, `content`, `parentCommentId`, `likeCount` |
| `Bookmark` | User's saved library | `userId`, `postId`, `savedAt` |
| `Notification` | Real-time alerts | `userId`, `actorId`, `type` (LIKE/FOLLOW/COMMENT), `isRead` |
| `UserAnalytics` | Implicit interest tracking | `userId`, `currentStreak`, `dailyReadingMinutes`, `categoryViews` (Map) |
| `ReadHistory` | Prevents duplicate view logging | `userId`, `postId`, `viewedAt`, `percentageCompleted` |
| `Donation` | Financial transaction log | `monetizationType` (SUBSCRIPTION/TIP), `amount`, `status` (SUCCESS/FAILED), `razorpayOrderId` |
| `WriterSubscription` | Per-writer access grants | `subscriberId`, `writerId`, `expiresAt`, `status` |
| `Report` | Content moderation flags | `reporterId`, `targetType` (POST/USER/COMMENT), `targetId`, `reason` |
| `Category` | Global topic taxonomy | `name`, `slug`, `iconUrl`, `description`, `postCount` |
| `ContactQuery` | Support tickets | `name`, `email`, `subject`, `message`, `status` (OPEN/RESOLVED) |

### MongoDB Collections Reference

| Collection | Java Model | Traffic Profile |
|---|---|---|
| `users` | User.java | Heavy Read / Moderate Update |
| `posts` | Post.java | Heavy Read / Light Write |
| `comments` | Comment.java | Moderate Read / Moderate Write |
| `notifications` | Notification.java | Heavy Write / Moderate Read |
| `user_analytics` | UserAnalytics.java | Constant Background Writes |
| `read_history` | ReadHistory.java | High Velocity Writes (TTL Indexed) |
| `donations` | Donation.java | Critical Path (Transactions) |

**Critical Indexes:**
- `posts.slug` — Unique Index for post loading.
- `posts.status + posts.publishedAt` — Compound Index for feed sorting.
- `users.username` — Unique Index for profile routing (`/u/[handle]`).
- `notifications.userId + notifications.isRead` — Compound for navbar badge counts.
- `read_history.viewedAt` — TTL Index, auto-drops documents older than 30 days.

---

## API Reference

**Base URL:** `https://pensieri-blog-api.onrender.com/api`  
**Auth:** `Authorization: Bearer <jwt_token>`  
**Response wrapper:** `{ "success": true, "message": "...", "data": { ... } }`

### Auth Endpoints (`/api/auth`)

| Method | Path | Auth? | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Initiates registration, sends OTP |
| POST | `/api/auth/verify-otp` | No | Validates OTP, creates user |
| POST | `/api/auth/resend-otp` | No | Resends 6-digit code |
| POST | `/api/auth/login` | No | Validates credentials, returns JWT |
| POST | `/api/auth/google` | No | Verifies Firebase token, returns JWT |
| POST | `/api/auth/logout` | Yes | Blacklists current JWT in Redis |
| POST | `/api/auth/forgot-password` | No | Sends reset email |
| POST | `/api/auth/reset-password` | No | Saves new hashed password |

### Post Endpoints (`/api/posts`)

| Method | Path | Auth? | Description |
|---|---|---|---|
| GET | `/api/posts` | No | Paginated list of PUBLISHED posts |
| GET | `/api/posts/trending` | No | Decay-score aggregation |
| GET | `/api/posts/premium` | No | Filters `isPremium=true` |
| GET | `/api/posts/search` | No | Text query across titles and tags |
| GET | `/api/posts/{slug}` | No | Single post. Truncates content if premium + unauthorized |
| POST | `/api/posts/{slug}/view` | No | Tracks unique reading session |
| POST | `/api/posts` | Yes | Multipart formData: HTML content + Cloudinary cover image |
| PUT | `/api/posts/{id}` | Yes | Author update. Reverts to PENDING_REVIEW if published |
| DELETE | `/api/posts/{id}` | Yes | Soft or hard deletion by Author/Admin |
| GET | `/api/posts/sitemap` | No | Yields all slugs for Next.js dynamic generation |

### User Endpoints (`/api/users`, `/api/follow`)

| Method | Path | Auth? | Description |
|---|---|---|---|
| GET | `/api/users/profile` | Yes | Own complete profile |
| PUT | `/api/users/profile` | Yes | Update bio, social links, username |
| GET | `/api/users/public/{handle}` | No | Public view, follower counts |
| POST | `/api/follow/{userId}` | Yes | Follow — adds to followingIds, triggers notification |
| DELETE | `/api/follow/{userId}` | Yes | Unfollow |
| GET | `/api/users/suggested` | Yes | Recommends new profiles to follow |
| GET | `/api/users/dashboard` | Yes | Analytics aggregate (Income, Views, Partner threshold) |

### AI Endpoints (`/api/ai`) — Rate limited: 5/minute

| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/fix-grammar` | Corrects grammar and syntax |
| POST | `/api/ai/enhance` | Enhances vocabulary and style |
| POST | `/api/ai/shorten` | Summarizes text payload |
| POST | `/api/ai/continue` | Auto-completes paragraph context |
| POST | `/api/ai/analyze-seo` | Returns 0–100 score + JSON suggestions |
| POST | `/api/ai/generate-titles` | Yields 5 headline variants |
| POST | `/api/ai/generate-tags` | Extracts top 5 context tags |
| POST | `/api/ai/writer-advice` | Inactivity pulse advice generator |
| POST | `/api/ai/reading-assistant` | Interactive chat against a specific post |

### Interaction Endpoints

| Method | Path | Auth? | Description |
|---|---|---|---|
| POST | `/api/likes/toggle/{postId}` | Yes | Adds/removes like, adjusts InkScore |
| GET | `/api/comments/post/{postId}` | No | Nested comment hierarchy |
| POST | `/api/comments` | Yes | `{ postId, content }` |
| POST | `/api/bookmarks/toggle/{id}` | Yes | Adds/removes from personal library |

### Donation & Payment Endpoints (`/api/donations`)

| Method | Path | Auth? | Description |
|---|---|---|---|
| POST | `/api/donations/create-order` | Yes | Generates Razorpay order UUID |
| POST | `/api/donations/razorpay-webhook` | No | Server-to-server HMAC signature verify |
| POST | `/api/donations/bmc-webhook` | No | Server-to-server Buy Me a Coffee |
| GET | `/api/donations/earnings` | Yes | Sum of unpaid writer royalties |
| POST | `/api/donations/payout` | Yes | Requests admin to wire earningsBalance |

### Admin Endpoints (`/api/admin`) — Requires ADMIN JWT

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/metrics` | Heavy aggregate of platform totals |
| GET | `/api/admin/posts/pending` | Moderation queue |
| POST | `/api/admin/posts/{id}/review` | Approves, rejects, banishes content |
| POST | `/api/admin/users/{id}/strike` | Issues violation flag. Bans at 3 |
| POST | `/api/admin/maintenance/sync` | Repairs outdated author snapshots |

### Media & Category Endpoints

| Method | Path | Auth? | Description |
|---|---|---|---|
| POST | `/api/media/upload` | Yes | Uploads image to Cloudinary CDN |
| POST | `/api/media/fetch-external` | Yes | Node.js proxy to bypass CORS on Unsplash |
| GET | `/api/categories` | No | Fetch global taxonomy |

---

## AI Orchestrator (`AIServiceImpl`)

The most mechanically complex class in the platform — a routing layer for 15 AI operations.

### Load Balancing
Three `GROQ_API_KEY` values are stored in an array. An `AtomicInteger` increments on every request, selecting `keys[index % 3]`. This bypasses single-key rate limits.

### Provider Failover Chain
If all 3 Groq keys hit HTTP 429, the request falls back:

| Request Goal | Primary | Fallback 1 | Fallback 2 | Model |
|---|---|---|---|---|
| Grammar / Edit | Groq | OpenRouter | Cohere | Llama 3 8B |
| Title Generation | Groq | OpenRouter | Cohere | Llama 3 70B |
| SEO Extraction | Cohere | Groq | OpenRouter | Command-R |
| Image Generation | Pollinations.ai | N/A | N/A | Stable Diffusion |

### Rate Limiting via Redis
Before any AI request leaves the server, backend increments `ai_usage:{userId}` in Redis (TTL: 60s). Count > 5 → `429 Too Many Requests`.

### AI Response Caching
Identical prompts + payload hashes are cached in Redis (`ai_cache:{promptHash}`, TTL: 24h). Repeated "Generate Title" on identical text bypasses Groq entirely.

---

## Editor & Publish Flow (`/write`)

The most complex UI component (~1,200 lines). Uses **Tiptap v3** (ProseMirror-based).

### Tiptap Extensions
- Stock: bold, italics, blockquotes, syntax-highlighted code blocks (lowlight), tables.
- Custom `PasteRule` extensions: Spotify URLs and X/Twitter links auto-convert to embedded iframes on paste.
- Floating formatting toolbar via `@tiptap/extension-bubble-menu`.

### AI Authoring Tools in Editor
- **Grammar / Enhancement**: User selects text → AI modal opens → selected substring + full document HTML dispatched to Groq/OpenRouter queue.
- **Writing Advice Pulse**: If idle `inactivityTimerRef` reaches 30s on a post >50 chars, a pulsing bulb appears with momentum advice.
- **SEO Analyzer**: Draft sent to Cohere Semantic AI → structured JSON score (0–100) with keyword critique.

### Publish Pipeline (Client-side Processing)
1. `scanContent()` checks against `communityGuidelines.json`. Banned words → halt + highlight.
2. DOM is parsed. Local base64/blob `<img>` tags → upload to `/api/media/upload` (Cloudinary).
3. Base64 `src` tags hot-swapped for CDN URLs.
4. FormData serialized (cleaned HTML payload + cover image).
5. `POST /api/posts` sent to backend.
6. Backend: OWASP sanitization → slug generation → save as `PENDING_REVIEW`.
7. Auto-save: `localStorage` background process (`pensieri-draft`) runs every 5 seconds. Purged on successful publish.

---

## Recommendation & Trending Algorithms

### Trending Decay Formula
```
Score = (UniqueViews + (Likes × 5) + (Comments × 10)) / (HoursSincePublish + 2)^1.8
```
Fresh content cycles through the top every 24–48 hours. Executed as a MongoDB aggregation pipeline.

### Personalized Recommendation Engine
Hybrid scoring for "Recommended For You" feed:
1. **Explicit** (+20 pts): Post category matches user's `interests` array.
2. **Implicit** (+10 pts): Post category matches user's top `UserAnalytics.categoryViews` map entry.
3. **Engagement** (+Post Engagement Score × 0.2).

---

## Gamification & Monetization

### InkScore
Reputation metric. Awards: +1 per Like received, +5 per Post published, +10 per Donation received.

### Badges
`evaluateWriterBadges()` and `evaluateReaderBadges()` run against fixed thresholds (e.g., 1,000 views = "Wordsmith").

### Supporter Tiers (INR)
| Tier | Threshold |
|---|---|
| BRONZE | > ₹0 and < ₹300 |
| SILVER | ≥ ₹300 |
| GOLD | ≥ ₹1,500 |
| PLATINUM | ≥ ₹15,000 |
| LIFETIME | ≥ ₹15,000 (no expiry) |

### Partner Program (60/40 Revenue Split)
Writer earns 60% of each donation. Pensieri retains 40% (LLM costs, DB scaling). Eligibility: ≥100 unique views + ≥10 followers → `isPartner` flips to `true`.

---

## Caching Strategy (Three Tiers)

| Tier | Mechanism | What's Cached |
|---|---|---|
| **Client** | TanStack Query `staleTime` + `SyncStoragePersister` | Profiles, categories, feeds — survives page unload for PWA offline |
| **Network** | Redis Cloud | JWT blacklist (O(1) auth check), OTP state (10min TTL), AI rate limit counters (60s TTL), AI response cache (24h TTL) |
| **Database** | MongoDB compound indexes | posts.slug (exact lookup), posts.status+score (feed), users.username (profile routing) |

### Redis Key Map

| Key Pattern | TTL | Purpose |
|---|---|---|
| `jwt_blacklist:{tokenId}` | Match JWT expiry | Blocks logged-out tokens |
| `ai_usage:{userId}` | 60 seconds | Rate limits AI to 5 ops/min |
| `otp:{email}` | 10 minutes | Email verification enforcement |
| `ai_cache:{promptHash}` | 24 hours | Caches Groq outputs for identical queries |

---

## Key Data Flows

### Post Creation → Publication
```
Writer clicks Publish
→ Client: scanContent() against communityGuidelines.json
  → [Violations] Halt + highlight banned words
  → [Clean] Extract local base64 <img> tags
    → Loop: Upload each to Cloudinary, get CDN URL
    → Swap base64 for CDN URLs in HTML
→ POST /api/posts (multipart: JSON + coverImage)
→ Backend: OWASP sanitize HTML
→ Backend: Generate unique slug
→ Save to MongoDB (status: PENDING_REVIEW)
→ 201 Created → Redirect to dashboard, clear draft
```

### Authentication (OTP Registration)
```
Register form submit
→ POST /api/auth/register (rate-limited via Redis)
→ Backend saves OTP to Redis (10min TTL), sends email via SMTP microservice
→ User enters 6-digit code → POST /api/auth/verify-otp
→ Redis OTP wiped, User document created, JWT issued
→ JWT stored in localStorage + pensieri-auth-token cookie
```

### Authentication (Google OAuth)
```
Click "Sign in with Google"
→ Firebase SDK prompts Google sign-in
→ Firebase returns OAuth token
→ Frontend: POST /api/auth/google with Firebase token
→ Backend: Firebase Admin SDK verifies token
→ Pensieri JWT issued
```

### Real-time Chat
```
Open chat with user
→ POST /api/chat/token (JWT required)
→ Backend mints Custom Firebase Token (Firebase Admin SDK)
→ Client: signInWithCustomToken(token)
→ Firebase authenticated
→ Client: RTDB setStatus ONLINE, onDisconnect setStatus OFFLINE
→ Client: onSnapshot(chats/{chatId}/messages) — real-time delta updates
```

### AI Request (with fallback)
```
User submits AI request
→ Redis INCR ai_usage:{userId} (TTL: 60s)
  → [Count > 5] 429 Too Many Requests
→ Redis GET ai_cache:{promptHash}
  → [Cache Hit] Return cached response instantly
  → [Cache Miss] AtomicInteger.increment() % 3 → select Groq key
    → [429 from Groq] Fallback to OpenRouter (Mistral)
    → [Success] Redis SET ai_cache:{hash} (TTL: 24h)
→ 200 OK
```

### Donation & Tier Unlock
```
Supporter clicks Donate ₹1000
→ POST /api/donations/create-order → Razorpay order UUID returned
→ Razorpay modal opens (native UPI/card checkout)
→ Payment completes → Razorpay POSTs to /api/donations/razorpay-webhook
→ Backend computes HMAC-SHA256(RAZORPAY_KEY_SECRET)
  → [Signature mismatch] Flag suspicious attempt
  → [Signature matches] Save Donation (SUCCESS)
    → Credit writer 60% earnings
    → Update supporterStatus (e.g., SILVER)
    → Fire notification to writer
→ Frontend: display success confetti
```

---

## Admin Panel (`/admin`)

Isolated SPA secured via separate `pensieri_admin_token` cookie validation. Navigation via URL query params (`?tab=`), no full page reloads.

| Tab | Function |
|---|---|
| `?tab=overview` | Real-time metrics (DAUs, total users, posts, donations). Recharts visualizations. Early-warning for traffic spikes. |
| `?tab=posts` | PENDING_REVIEW moderation queue. Inline HTML preview. Approve (→ PUBLISHED) or Reject (→ requires `rejectionReason` string shown to author). Hard-delete for DMCA. |
| `?tab=users` | Role assignment (USER → EDITOR/ADMIN). 3-strike system (auto-IP ban at 3 strikes). Badge grants ("Staff Pick", "Verified Author"). Unban. |
| `?tab=reports` | Crowdsourced flags. Admins see target + reporter + reason. Can dismiss or take punitive action (delete + strike). |
| `?tab=categories` | Create/edit global categories. Slug auto-generated. Updates navigation menus for all users immediately. |
| `?tab=queries` | Internal support desk. ContactQuery documents (OPEN/RESOLVED ticketing). |
| `?tab=donations` | Real-time ledger of Razorpay + BMC transactions. Payout requests (writer's PayoutDetails: UPI/bank). Admin manually wires payment → "Mark as Paid" zeros earningsBalance + sends notification. |
| `?tab=maintenance` | Danger zone. Sync Author Snapshots (force-resync denormalized author data in all post documents). Reset Redis Caches (panic button, bypasses TTLs). |

---

## PWA & Offline Support

- Uses `@ducanh2912/next-pwa`.
- Service Worker registered via `next.config.ts` — pre-caches core static assets and HTML templates.
- Offline fallback: non-cached pages → custom `/offline` route.
- `<ConnectivityBanner />` listens to `navigator.onLine` API — alerts on connection loss, transitions on restore.

---

## Infrastructure & Deployment

### Environment Variables

**Frontend (`ink-wise/.env.local`):**
- `NEXT_PUBLIC_API_URL` — Spring Boot base URL
- `UNSPLASH_ACCESS_KEY` — Cover image fetching
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web client config (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, DATABASE_URL)

**Backend (`sbootBlogBackend-main/.env`):**
- `SPRING_DATA_MONGODB_URI`, `SPRING_DATA_REDIS_HOST/PORT/PASSWORD`
- `JWT_SECRET`, `JWT_EXPIRATION`
- `EMAIL_PROXY_URL`, `EMAIL_PROXY_SECRET`
- `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`
- `RAZORPAY_KEY_ID/KEY_SECRET`, `BMC_WEBHOOK_SECRET`
- `GROQ_API_KEY_1/2/3`, `OPENROUTER_API_KEY`, `COHERE_API_KEY`
- `FIREBASE_ADMIN_CREDENTIALS` (JSON stringified service account)

**SMTP Microservice (`smtp-microservice-main/.env`):**
- `GMAIL_USER`, `GMAIL_PASS` (Gmail App Password), `INTERNAL_SECRET`

### Docker (Backend)
```bash
# Build
docker build -t pensieri-backend .

# Run locally
docker run -p 8080:8080 --env-file .env pensieri-backend
```

### CI/CD
- **Frontend**: Push to `main` → Cloudflare Pages auto-deploys. Build command: `cross-env SKIP_ENV_VALIDATION=1 next build --webpack && npx @cloudflare/next-on-pages`
- **Backend**: Push to `main` → Render pulls from git, rebuilds Docker image, deploys with zero downtime.

---

## Known Tech Debt & Scalability Limits

| Issue | Current State | Future Fix |
|---|---|---|
| Denormalized author snapshots | Async repair job; at scale needs Kafka/RabbitMQ consumer | Dedicated event-driven consumer |
| Social follow arrays in User doc | O(1) mutual check but will breach MongoDB's 16MB limit at ~1M followers | Separate `FollowRelations` collection |
| Firestore message pagination | Full `onSnapshot()` on entire message subcollection; >5,000 messages will OOM clients | `startAfter()` cursor pagination |
| `UserController.java.recovered` | Legacy file in repo, safe to delete | Delete it |
| `AuthContext` typings | Scattered `any` types | Refactor to strict TypeScript interfaces |
| `ChatContext` cross-tab sync | Uses `setInterval` to poll localStorage | Replace with native `storage` window event listener |

---

## Local Development Setup

**Prerequisites:** Java 17+, Node.js 20+, Docker (optional), Firebase project.

**Backend:**
```bash
cd sbootBlogBackend-main
cp .env.example .env   # fill in MongoDB URI, Redis, etc.
./mvnw spring-boot:run  # API boots on localhost:8080
```

**Frontend:**
```bash
cd ink-wise
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8080/api
npm install && npm run dev  # UI boots on localhost:3000
```

**SMTP Proxy (optional, for OTP/password reset testing):**
```bash
cd smtp-microservice-main
npm install && npm start
# Set backend EMAIL_PROXY_URL to point to this local instance
```

**Regenerate API types after backend changes:**
```bash
cd ink-wise
npm run gen  # Orval re-reads localhost:8080/v3/api-docs and regenerates hooks
```
