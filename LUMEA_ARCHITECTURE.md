# Lumea.ink — Architecture Context

**Version:** 2.0 | **Last Updated:** June 2026  
**Status:** Active Development

---

## What Is Lumea?

Lumea is a modern storytelling platform — a Medium/Substack hybrid built from scratch with no legacy debt. It merges a distraction-free writing experience with native AI tooling and a full monetization stack.

Each published piece is called a *lumeo* (singular). The platform's north star: writing that matters, not content that converts.

---

## System Architecture: The Big Picture

Lumea is a **multi-service, two-gateway system** split across Cloudflare and AWS. Public reader traffic flows through AWS API Gateway. Writer/dashboard traffic flows through a Cloudflare Worker router — keeping the write path at edge with zero cold start.

### Service Registry

| Service | Stack | Host | Role |
|---|---|---|---|
| **Main Portal** | Next.js · Edge Runtime | Cloudflare Pages | Public reader experience + SEO |
| **Dashboard** | Next.js · Static Export | S3 + CloudFront | Writer & admin portal (CSR) |
| **AWS API Gateway** | Managed | AWS | Public gateway: rate limiting, WAF, JWT authorizer |
| **CF Worker Router** | Hono | Cloudflare Workers | Internal writer gateway: JWT verify + routing |
| **User-Auth Service** | Go + Gin | AWS Lambda | Registration, login, OAuth, RBAC, JWT issuance |
| **Content Service** | Hono (JS) | AWS Lambda | Public feed, blog detail, recommendations, search |
| **Post Service** | Hono (JS) | Cloudflare Worker | Create, edit, publish posts (writer-internal) |
| **Media Service** | Hono (JS) | Cloudflare Worker | Cloudinary signed URL generation |
| **Interaction Service** | Hono (JS) | AWS Lambda | Likes, comments, bookmarks, reports, InkScore |
| **Notification Service** | Hono (JS) | AWS Lambda (SQS trigger) | In-app bell notifications + FCM push |
| **Communication Service** | Hono (JS) | AWS Lambda | Transactional email + promotional email + WhatsApp |
| **Analytics Service** | Hono (JS) | AWS Lambda | Writer analytics event ingestion + aggregation |
| **AI Service** | FastAPI (Python) | Vercel | 15 AI writing features via litellm |

### Supporting Infrastructure

| Service | Provider | Role |
|---|---|---|
| **PostgreSQL** | AWS RDS (shared instance) | Auth + communication data (relational, ACID) |
| **MongoDB Atlas** | MongoDB | Posts, interactions, notifications, media metadata |
| **OpenSearch** | AWS OpenSearch (4 GB) | Full-text search + writer analytics aggregations |
| **Upstash Redis** | Upstash (HTTP) | JWT blacklist, feed cache, AI response cache, OTP, rate counters |
| **AWS SQS** | AWS | Email queues (two) + inter-service event bus |
| **AWS SNS** | AWS | Fan-out event distribution (publish, follow, like) |
| **Firebase** | Google BaaS | Real-time chat only (Firestore messages + RTDB presence) |
| **Cloudinary** | Cloudinary | Media CDN — image/audio upload + on-the-fly transforms |
| **AWS Secrets Manager** | AWS | All service secrets — no plaintext env vars |
| **AWS WAF** | AWS | Managed rules: SQLi, XSS, bad-bot filtering on API Gateway |

---

## Two-Gateway Pattern

This is the most important architectural decision to understand.

```
Public readers / API clients
         │
         ▼
  AWS API Gateway (api.lumea.ink)
  ├── JWT Lambda authorizer
  ├── AWS WAF (SQLi, XSS, bot rules)
  ├── Rate limiting per IP/user
  ├── Routes: /api/auth, /api/content, /api/interactions
  │           /api/notifications, /api/comms, /api/ai (proxy → Vercel)
  │           /api/search (proxy → OpenSearch)
  └── → Lambda functions (Auth, Content, Interaction, Notification, Comms, Analytics)

Dashboard (dash.lumea.ink — Next.js static export)
         │
         ▼
  CF Worker Router (writer.lumea.ink)
  ├── JWT verify (local — shared signing secret)
  ├── Upstash Redis blacklist check (~5ms HTTP)
  ├── CF Service Bindings (zero-latency routing)
  └── → Post Service CF Worker
      → Media Service CF Worker
```

CF Worker Router only serves the dashboard — it is never exposed as a public API. Post and Media CF Workers have no direct public URL.

---

## Frontend

### Main Portal — `lumea.ink`
- **Host:** Cloudflare Pages (`@cloudflare/next-on-pages` adapter)
- **Runtime:** `export const runtime = 'edge'` — runs from Cloudflare global edge, zero cold starts
- **Rendering:** SSR for all public pages (`/blog/[slug]`, `/`, `/u/[handle]`) — required for SEO and OG metadata
- **Auth:** Reads `lumea-auth-token` HTTP cookie in edge middleware for SSR protection. Stores JWT in `localStorage` for client-side Axios interceptor.

**Route Map:**

| Path | Rendering | Role |
|---|---|---|
| `/` | SSR | Home feed: Fresh Ink, Trending, Recommendations |
| `/blog/[slug]` | SSR | Post reading page — SEO-critical |
| `/u/[handle]` | SSR | Public writer profiles |
| `/explore` | SSR | Category browse + search |
| `/login`, `/register` | CSR | Auth flows |

**Edge Middleware (`middleware.ts`):** Runs before React renders. Reads `lumea-auth-token` cookie — redirects unauthenticated users from protected routes, redirects authenticated users away from login.

### Dashboard — `dash.lumea.ink`
- **Host:** AWS S3 (static files) + CloudFront distribution
- **Build:** `next.config.js` → `output: 'export'` → pure HTML/JS/CSS bundle
- **Deployment:** GitHub Actions → `aws s3 sync ./out s3://lumea-dashboard` → CloudFront cache invalidation
- **SSL:** ACM certificate (free) on `dash.lumea.ink` CloudFront distribution
- **Rendering:** 100% CSR — no SSR needed (SEO irrelevant for logged-in writer portal)
- **API calls:** Axios instance hits AWS API Gateway for standard ops, and `writer.lumea.ink` CF Worker Router for post/media writes

**Route Map:**

| Path | Role |
|---|---|
| `/` | Writer dashboard: analytics overview, recent posts |
| `/write` | Tiptap v3 editor — create/edit posts |
| `/posts` | Post management: drafts, published, pending review |
| `/analytics` | Per-post views, reading time, referrer breakdown |
| `/settings` | Profile, payout details, notification preferences |
| `/admin` | Admin moderation panel (ADMIN role only) |

**Provider Nesting Order (`app/layout.tsx`):**
1. `<QueryProvider>` — TanStack Query
2. `<ThemeProvider>` — CSS theme persistence
3. `<AuthProvider>` — JWT + login identity
4. `<BookmarkContext>` — depends on Auth (DB vs. cookie mode)
5. `<ChatContext>` — depends on Auth for Firebase identity
6. `<CallContext>` — depends on Chat

### API Client Layer (both apps)
- Spring Boot is replaced. Each app targets AWS API Gateway (`api.lumea.ink`) for public operations and `writer.lumea.ink` for writer operations.
- **Orval** (`npm run gen`) reads OpenAPI specs from each Lambda service and auto-generates TanStack Query hooks + TypeScript interfaces.
- Custom Axios instance:
  - **Request interceptor:** Injects `Authorization: Bearer <token>` from `localStorage`. Switches to `lumea_admin_token` if URL contains `/admin`.
  - **Response interceptor:** On 401, purges local caches, fires toast, redirects to login.

---

## API Gateways

### AWS API Gateway — `api.lumea.ink`

- **JWT Lambda Authorizer:** Validates RS256 token signature against the public key before any request reaches a Lambda. Returns an IAM policy — deny is cached for 5 minutes.
- **Rate Limiting:** 100 req/min per IP for public routes, 300 req/min per authenticated user.
- **AWS WAF:** Managed rule groups — CommonRuleSet (SQLi, XSS), AmazonIpReputationList (known bad bots). Applied to all routes.
- **CORS:** Allowlist: `lumea.ink`, `dash.lumea.ink`.
- **HTTP Proxy integrations:** `/api/ai/*` → Vercel AI Service URL. `/api/search` → OpenSearch endpoint.

### CF Worker Router — `writer.lumea.ink`

- Hono app deployed as a Cloudflare Worker.
- **JWT Validation (local):** Verifies HS256 token signature using `JWT_SECRET` env var — no network call.
- **Blacklist check:** `GET blacklist:{jti}` on Upstash Redis (~5ms HTTP). Rejects if key exists.
- **CF Service Bindings:** Zero-latency binding to Post and Media CF Workers — communication stays within Cloudflare's network.
- **Not public:** Only called by `dash.lumea.ink`. No direct URL exposed.

---

## Event Bus — AWS SNS + SQS

Inter-service communication is event-driven. Services never call each other's APIs directly for non-critical paths.

| Event | Producer | Consumers |
|---|---|---|
| `post.published` | Post CF Worker → HTTP to internal Lambda endpoint | Content (cache invalidate + OpenSearch index), Notification (fan-out to followers) |
| `post.liked` | Interaction Lambda | Notification, Interaction (InkScore update) |
| `post.commented` | Interaction Lambda | Notification |
| `user.followed` | Interaction Lambda | Notification |
| `user.banned` | User-Auth Lambda | Upstash Redis (write blacklist for all user JTIs) |
| `email.transactional` | Any service | Communication Lambda (transactional SQS queue) |
| `email.promotional` | Any service | Communication Lambda (promotional SQS queue) |

**CF Worker → event bridge:** Post CF Worker cannot write directly to AWS SQS (different cloud). Instead it fires an authenticated HTTP POST to `api.lumea.ink/internal/events` — a lightweight internal Lambda event receiver that fans out to SNS. This call is async (after responding to the writer).

---

## Services

### User-Auth Service

- **Stack:** Go 1.22 + Gin Gonic
- **Host:** AWS Lambda (two functions: `/auth/*` public, `/users/*` protected)
- **Database:** PostgreSQL — `auth` schema
- **Cold start:** ~100ms (Go binary, no JVM warmup)

**Responsibilities:**
- Registration with OTP email verification
- Login (local email/password + Google OAuth via Firebase token verification)
- JWT issuance (HS256 in development → RS256 in production)
- Password reset flow (token-based)
- Logout (writes JTI to Upstash Redis blacklist with TTL = remaining token validity)
- RBAC: roles `USER`, `EDITOR`, `ADMIN` stored on user record
- User ban: writes all active JTIs to Redis blacklist; fires `user.banned` SNS event
- Profile CRUD (`/users/*` handler)

**JWT Strategy:**
- Development: HS256 shared secret. Both Auth Lambda and CF Worker Router read the same `JWT_SECRET` from AWS Secrets Manager / CF Worker secrets.
- Production: Upgrade to RS256. Auth Lambda holds the private key. All other services hold only the public key — zero risk of signing key leakage.

**Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Initiates registration, sends OTP |
| POST | `/api/auth/verify-otp` | No | Validates OTP, creates user, issues JWT |
| POST | `/api/auth/resend-otp` | No | Resends 6-digit code |
| POST | `/api/auth/login` | No | Validates credentials, returns JWT |
| POST | `/api/auth/google` | No | Verifies Firebase token, issues Lumea JWT |
| POST | `/api/auth/logout` | Yes | Blacklists current JWT JTI in Upstash Redis |
| POST | `/api/auth/forgot-password` | No | Sends reset link via Communication service |
| POST | `/api/auth/reset-password` | No | Saves new bcrypt-hashed password |
| GET | `/api/users/profile` | Yes | Own complete profile |
| PUT | `/api/users/profile` | Yes | Update bio, social links, username |
| GET | `/api/users/public/{handle}` | No | Public profile view |
| POST | `/api/follow/{userId}` | Yes | Follow — fires `user.followed` SNS event |
| DELETE | `/api/follow/{userId}` | Yes | Unfollow |
| GET | `/api/users/suggested` | Yes | Profile recommendations |

---

### Content Service

- **Stack:** Hono (TypeScript)
- **Host:** AWS Lambda
- **Databases:** MongoDB Atlas (read-only on `posts`, `comments` counts), Upstash Redis (feed cache), OpenSearch (search + recommendations)

**Responsibilities:**
- Home feed (Fresh Ink, Trending, Recommended For You)
- Blog detail page — fetches post + author snapshot + comment count
- Full-text search — queries OpenSearch `posts` index
- Recommendation engine — hybrid scoring (interests + analytics + engagement)
- OpenSearch index management: listens for `post.published` / `post.updated` / `post.deleted` events and upserts/deletes from the `posts` index
- Feed cache: writes `feed_cache:{key}` to Upstash Redis (TTL 5 min), invalidated on `post.published` event

**Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/content/feed` | No | Paginated feed — Fresh Ink tab |
| GET | `/api/content/trending` | No | Trending decay-score aggregation |
| GET | `/api/content/recommended` | Yes | Personalized recommendations |
| GET | `/api/content/posts/{slug}` | Optional | Blog detail. Truncates if premium + unauthorized |
| POST | `/api/content/posts/{slug}/view` | No | Tracks unique reading session → Analytics service event |
| GET | `/api/content/search` | No | Full-text OpenSearch query |
| GET | `/api/content/posts/sitemap` | No | All published slugs for Next.js sitemap |
| GET | `/api/content/categories` | No | Global category taxonomy |

---

### Post Service

- **Stack:** Hono (TypeScript)
- **Host:** Cloudflare Worker (called only from CF Worker Router)
- **Database:** MongoDB Atlas (owner of `posts`, `categories`, `media_metadata` collections)
- **Cold start:** ~0ms (V8 isolate)

**Responsibilities:**
- Full CRUD on posts (create, read, update, delete)
- Draft autosave (writes to MongoDB `posts` with `status: DRAFT`)
- Publish pipeline: OWASP HTML sanitization → slug generation → status transition → fires `post.published` HTTP event to internal Lambda
- Community guidelines scan (server-side, using `communityGuidelines.json` ruleset)
- Bait-and-switch protection: if a PUBLISHED post is edited, compare before/after HTML length and structure — significant deviation reverts to `PENDING_REVIEW`

**Endpoints (all require CF Worker Router JWT):**

| Method | Path | Description |
|---|---|---|
| GET | `/posts` | Writer's own posts (all statuses) |
| GET | `/posts/{id}` | Single post including draft content |
| POST | `/posts` | Create post (DRAFT status) |
| PUT | `/posts/{id}` | Update post content / metadata |
| POST | `/posts/{id}/publish` | Trigger publish pipeline |
| DELETE | `/posts/{id}` | Soft delete |

---

### Media Service

- **Stack:** Hono (TypeScript)
- **Host:** Cloudflare Worker (called only from CF Worker Router)
- **Database:** None — metadata stored in MongoDB by Post Service after upload

**Responsibilities:**
- Generate Cloudinary signed upload URL (`POST /media/signed-url`): returns a short-lived signed URL + upload preset. Browser uploads the file directly to Cloudinary CDN — the signed URL never exposes the Cloudinary API secret.
- Unsplash proxy (`GET /media/unsplash`): proxies Unsplash API to avoid CORS and hide the API key from browser.
- After upload, browser sends the resulting Cloudinary URL back to Post Service, which persists it to `media_metadata` in MongoDB.

---

### Interaction Service

- **Stack:** Hono (TypeScript)
- **Host:** AWS Lambda
- **Database:** MongoDB Atlas (owner of `comments`, `likes`, `bookmarks`, `ink_scores`, `reports`)

**Responsibilities:**
- Toggle likes on posts and comments — fires `post.liked` SNS event, updates `ink_scores`
- Nested comment threads (parent/child structure, up to 2 levels deep)
- Toggle bookmarks
- Content reports (flagging posts/comments/users for moderation)
- InkScore calculation: +1 per like received, +5 per post published, +10 per donation received

**Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/interactions/likes/toggle/{postId}` | Yes | Like/unlike post, update InkScore |
| GET | `/api/interactions/comments/{postId}` | No | Nested comment tree |
| POST | `/api/interactions/comments` | Yes | `{ postId, content, parentCommentId? }` |
| DELETE | `/api/interactions/comments/{id}` | Yes | Author or ADMIN delete |
| POST | `/api/interactions/bookmarks/toggle/{postId}` | Yes | Add/remove bookmark |
| GET | `/api/interactions/bookmarks` | Yes | User's saved library |
| POST | `/api/interactions/reports` | Yes | Flag content for moderation |

---

### Notification Service

- **Stack:** Hono (TypeScript)
- **Host:** AWS Lambda — triggered by SQS (not HTTP-facing for writes)
- **Database:** MongoDB Atlas (owner of `notifications` collection)

**Responsibilities:**
- Consumes events from SQS notification queue
- Writes notification documents to MongoDB
- Sends FCM push notifications for PWA (new like, new follower, comment reply)
- Badge evaluation: after each write, checks InkScore thresholds and grants badges
- HTTP endpoint for reads (notification bell in dashboard)

**Read Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | Yes | Unread + recent notifications |
| POST | `/api/notifications/read/{id}` | Yes | Mark single as read |
| POST | `/api/notifications/read-all` | Yes | Mark all as read |

---

### Communication Service

- **Stack:** Hono (TypeScript)
- **Host:** AWS Lambda
- **Database:** PostgreSQL — `comms` schema
- **Queues:** Two SQS queues — `lumea-transactional` and `lumea-promotional`

**Responsibilities:**
- **Transactional queue** (AWS SES): OTP emails, password resets, welcome emails, admin alerts. Hard daily limit enforced (prevents SES account suspension).
- **Promotional queue** (Resend): Newsletters, digest emails, feature announcements. Separate daily budget with its own limit counter.
- WhatsApp notifications via Twilio WhatsApp Business API
- Email preference management (`comms.preferences` table — unsubscribe flags per type)
- Delivery receipt webhooks from SES + Resend → logged to `comms.email_log`

**Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/comms/send` | Internal token | Enqueues email to correct SQS queue |
| GET | `/api/comms/preferences` | Yes | User's email opt-in/out settings |
| PUT | `/api/comms/preferences` | Yes | Update preferences |
| POST | `/api/comms/unsubscribe` | Token in URL | One-click unsubscribe from link in email |

---

### Analytics Service

- **Stack:** Hono (TypeScript)
- **Host:** AWS Lambda
- **Database:** OpenSearch — `analytics` index (owner)

**Responsibilities:**
- Ingest view events from Content Service (post_id, user_id, referrer, reading_time, percentage_read)
- Writer analytics queries: per-post views, unique readers, referrer breakdown, reading time histograms, time-series charts
- Trending score input: pre-aggregates engagement counts for the trending decay formula
- Uses OpenSearch aggregations instead of heavy MongoDB aggregation pipelines

**Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/analytics/events` | Internal token | Ingest view/engagement event |
| GET | `/api/analytics/writer` | Yes | Aggregate stats for logged-in writer |
| GET | `/api/analytics/posts/{id}` | Yes | Per-post detailed breakdown |
| GET | `/api/analytics/platform` | ADMIN | Platform-wide metrics |

---

### AI Service

- **Stack:** FastAPI (Python 3.12) + litellm
- **Host:** Vercel Serverless Functions
- **Routing:** AWS API Gateway HTTP proxy integration — `/api/ai/*` → Vercel URL
- **Cache:** AI responses cached in Upstash Redis (`ai_cache:{promptHash}`, TTL 24h) — identical prompts skip LLM calls entirely

**Provider Failover Chain:**

| Feature | Primary | Fallback 1 | Fallback 2 | Model |
|---|---|---|---|---|
| Grammar / Enhance | Groq | OpenRouter | Cohere | Llama 3 8B |
| Title Generation | Groq | OpenRouter | Cohere | Llama 3 70B |
| SEO Extraction | Cohere | Groq | OpenRouter | Command-R |
| Expand / Shorten | Groq | OpenRouter | — | Llama 3 8B |
| Reading Assistant | Groq | OpenRouter | — | Llama 3 70B |

**Load Balancing:** Three `GROQ_API_KEY` values stored in an array. Round-robin via `AtomicInteger(index % 3)` to distribute load across keys and stay under per-key rate limits.

**Rate Limiting:** Redis `INCR ai_usage:{userId}` (TTL 60s). Count > 5 → 429 Too Many Requests.

**Endpoints (all require JWT, rate limited 5/min):**

| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/fix-grammar` | Grammar and syntax corrections |
| POST | `/api/ai/enhance` | Vocabulary and style enhancement |
| POST | `/api/ai/shorten` | Text summarization |
| POST | `/api/ai/continue` | Paragraph auto-completion |
| POST | `/api/ai/analyze-seo` | 0–100 SEO score + keyword suggestions |
| POST | `/api/ai/generate-titles` | 5 headline variants |
| POST | `/api/ai/generate-tags` | Top 5 context tags |
| POST | `/api/ai/writer-advice` | Inactivity writing momentum pulse |
| POST | `/api/ai/reading-assistant` | Interactive chat against a specific post |

---

## Security Architecture

### JWT Lifecycle

1. User authenticates via User-Auth Lambda → JWT issued (HS256 / RS256)
2. JWT payload: `{ user_id, role, plan, email, jti, exp }`
3. JWT stored in `localStorage` (client-side Axios) + `lumea-auth-token` HTTP cookie (SSR + edge middleware)
4. On each request: AWS API Gateway Lambda Authorizer validates signature → allows/denies
5. CF Worker Router validates locally (no network hop) + Upstash Redis blacklist check
6. On logout: User-Auth Lambda writes `blacklist:{jti}` to Upstash Redis (TTL = remaining token life)

### Cross-Platform Auth (Auth on AWS ↔ Post Service on CF)

Auth and Post service share the same JWT signing secret — Post CF Worker validates tokens locally without calling Auth Lambda. The only shared runtime dependency is Upstash Redis (HTTP-based, works from both CF Workers and AWS Lambda).

```
Auth Lambda issues JWT (signed with JWT_SECRET)
        ↓
CF Worker Router receives request from Dashboard
  1. jwt.verify(token, JWT_SECRET)  ← local, 0ms
  2. GET blacklist:{jti} on Upstash  ← 5ms HTTP
  3. Route to Post CF Worker via Service Binding
```

### RBAC

Three roles stored on the user record:
- `USER` — create posts, like, comment, edit own profile
- `EDITOR` — elevated read access, bypasses certain paywalls
- `ADMIN` — full platform access: moderation, strikes, maintenance

Admin routes on AWS API Gateway enforce an additional `ADMIN` role check in the Lambda authorizer. The Dashboard Axios config switches to `lumea_admin_token` on any URL containing `/admin`.

### Content Security

**OWASP HTML Sanitization (Post Service):** Before any post saves to MongoDB, the HTML payload is sanitized. Permits structural tags (`<p>`, `<h1>`, `<b>`, `<img src="...">`). Strips `<script>`, event handlers (`onload`, `onclick`), and `<iframe>`.

**Community Guidelines Scanner (Post Service):** Server-side check against `communityGuidelines.json` (slurs + banned phrase regexes) on publish. Violations return 422 with highlighted positions.

**Bait-and-Switch Protection (Post Service):** If a PUBLISHED post is edited, the service compares before/after HTML length and tag structure. Significant deviation (>20% change) reverts status to `PENDING_REVIEW` while preserving the original content live.

**Cloudinary Signed URLs (Media Service):** The Cloudinary API secret never touches the browser. CF Worker generates a short-lived signed upload URL — browser uploads directly to CDN using that URL.

---

## Data Models

### User Model (PostgreSQL — `auth.users`)

**Core Identity:** `id`, `email`, `password_hash` (bcrypt, null if OAuth), `username`, `name`, `first_name`, `last_name`, `profile_picture`, `cover_image`, `bio`, `tagline`, `auth_provider` (LOCAL/GOOGLE), `role` (USER/EDITOR/ADMIN), `is_verified`, `email_verified`

**Gamification:** `ink_score`, `badges` (JSON array), `followers_count`, `following_count`

**Monetization:** `is_partner`, `supporter_status` (NONE/BRONZE/SILVER/GOLD/PLATINUM/LIFETIME), `supporter_expiry_date`, `earnings_balance`, `total_earned`, `upi_id`, `bank_account_number`, `ifsc_code`, `account_holder_name`

**Platform Restrictions:** `is_banned`, `strikes`, `posts_published_this_month`, `last_publish_window_start`, `is_commenting_restricted`, `commenting_restriction_end`, `commenting_restriction_reason`

**Metadata:** `interests` (JSON array — recommendation engine), `joined_at`, `last_login_at`, `twitter`, `github`, `linkedin`, `website`

### Post Model (MongoDB — `posts` collection, owned by Post Service)

**Core Content:** `_id`, `title`, `slug` (unique, collision-safe), `content` (sanitized HTML), `excerpt`, `cover_image`, `cover_image_credit`, `status` (DRAFT/PENDING_REVIEW/PUBLISHED/REJECTED/ARCHIVED), `is_premium`, `category`, `tags`

**Denormalized Author Snapshot:** `author { id, name, username, profile_picture, bio }` — embedded to avoid join on every feed query. An async background job syncs snapshots when a user updates their profile.

**Engagement Metrics:** `view_count`, `unique_view_count`, `like_count`, `comment_count`, `share_count`, `bookmark_count`, `reading_time` (avg 200 WPM), `score` (trending decay)

**SEO:** `meta_title`, `meta_description`, `created_at`, `updated_at`, `published_at`, `rejection_reason`

### Supporting Models (MongoDB)

| Collection | Owner | Key Fields |
|---|---|---|
| `comments` | Interaction Service | `post_id`, `user_id`, `content`, `parent_comment_id`, `like_count` |
| `likes` | Interaction Service | `user_id`, `post_id`, `created_at` |
| `bookmarks` | Interaction Service | `user_id`, `post_id`, `saved_at` |
| `ink_scores` | Interaction Service | `user_id`, `score`, `badges`, `updated_at` |
| `notifications` | Notification Service | `user_id`, `actor_id`, `type`, `post_id`, `is_read`, `created_at` |
| `media_metadata` | Post Service | `file_id`, `cloudinary_url`, `uploader_id`, `post_id`, `content_type`, `size_bytes` |
| `categories` | Post Service | `name`, `slug`, `icon_url`, `description`, `post_count` |

### PostgreSQL Schemas

**`auth` schema:**
- `auth.users` — all user data (see User Model above)
- `auth.sessions` — active session tracking, `user_id`, `jti`, `issued_at`, `expires_at`, `ip`, `user_agent`

**`comms` schema:**
- `comms.email_log` — `id`, `to`, `subject`, `template_id`, `status`, `provider` (SES/RESEND), `sent_at`, `delivered_at`
- `comms.templates` — `id`, `name`, `subject`, `html_body`, `updated_at`
- `comms.preferences` — `user_id`, `transactional_enabled`, `newsletter_enabled`, `digest_enabled`, `whatsapp_enabled`

### OpenSearch Indices

**`posts` index** (owned by Content Service):
```json
{
  "mappings": {
    "properties": {
      "post_id":     { "type": "keyword" },
      "title":       { "type": "text", "analyzer": "english" },
      "excerpt":     { "type": "text", "analyzer": "english" },
      "content_text":{ "type": "text", "analyzer": "english" },
      "tags":        { "type": "keyword" },
      "category":    { "type": "keyword" },
      "author_name": { "type": "text" },
      "status":      { "type": "keyword" },
      "published_at":{ "type": "date" },
      "like_count":  { "type": "integer" },
      "view_count":  { "type": "integer" }
    }
  }
}
```

**`analytics` index** (owned by Analytics Service):
```json
{
  "mappings": {
    "properties": {
      "post_id":          { "type": "keyword" },
      "user_id":          { "type": "keyword" },
      "event_type":       { "type": "keyword" },
      "referrer":         { "type": "keyword" },
      "reading_time_sec": { "type": "integer" },
      "percentage_read":  { "type": "float" },
      "timestamp":        { "type": "date" }
    }
  }
}
```

**OpenSearch capacity (4 GB budget):**
- `posts` index: ~1.5 GB (1M posts × ~1.5 KB each)
- `analytics` index: ~1.5 GB (daily events, ~2 years)
- 1 GB headroom for replicas + merge overhead
- Use ILM (Index Lifecycle Management) policies to roll analytics to warm/cold tiers and keep the hot index small

### Upstash Redis Key Map

| Key Pattern | TTL | Owner | Purpose |
|---|---|---|---|
| `jwt_blacklist:{jti}` | Match JWT expiry | User-Auth | Blocks logged-out/banned tokens |
| `otp:{email}` | 10 minutes | User-Auth | OTP verification enforcement |
| `feed_cache:{hash}` | 5 minutes | Content | Home feed query result cache |
| `ai_usage:{userId}` | 60 seconds | AI Service | Rate limiting: 5 AI ops/min |
| `ai_cache:{promptHash}` | 24 hours | AI Service | Identical AI prompt cache |
| `ratelimit:{ip}:{route}` | 60 seconds | API Gateway authorizer | Per-IP rate counters |

---

## MongoDB Critical Indexes

| Collection | Index | Type | Purpose |
|---|---|---|---|
| `posts` | `slug` | Unique | Post loading by URL slug |
| `posts` | `status, published_at` | Compound | Feed sorting |
| `posts` | `status, score` | Compound | Trending feed |
| `posts` | `author.id, status` | Compound | Writer's own post list |
| `notifications` | `user_id, is_read` | Compound | Navbar unread badge count |
| `likes` | `user_id, post_id` | Unique Compound | Prevent duplicate likes |
| `bookmarks` | `user_id, post_id` | Unique Compound | Prevent duplicate bookmarks |

---

## Editor & Publish Flow

The dashboard editor uses **Tiptap v3** (ProseMirror-based). Calls Post CF Worker via `writer.lumea.ink`.

### Tiptap Extensions
- Stock: bold, italics, blockquotes, syntax-highlighted code blocks (lowlight), tables
- Custom `PasteRule`: Spotify URLs + X/Twitter links auto-convert to embedded iframes on paste
- Floating toolbar: `@tiptap/extension-bubble-menu`

### AI Authoring Tools in Editor
- **Grammar / Enhancement:** User selects text → AI modal → selected substring + document HTML dispatched to `/api/ai/fix-grammar` or `/api/ai/enhance`
- **Writing Advice Pulse:** If `inactivityTimerRef` reaches 30s on a post > 50 chars, a pulsing bulb appears with momentum advice from `/api/ai/writer-advice`
- **SEO Analyzer:** Draft sent to `/api/ai/analyze-seo` → structured JSON score (0–100) with keyword critique

### Publish Pipeline (Client + Server)
1. Dashboard calls `POST /posts/{id}/publish` on Post CF Worker
2. Post CF Worker: `scanContent()` against `communityGuidelines.json` → 422 if violations
3. DOM parsed: local blob/base64 `<img>` tags → get signed URL from Media CF Worker → upload directly to Cloudinary → swap `src` for CDN URL
4. Post CF Worker: OWASP HTML sanitization
5. Post CF Worker: slug generation (collision-safe)
6. Save to MongoDB `posts` with `status: PENDING_REVIEW`
7. **Async:** Post CF Worker fires `POST api.lumea.ink/internal/events` with `{ event: "post.published", post_id }` using internal service token
8. Content Lambda receives event → upserts to OpenSearch `posts` index → invalidates `feed_cache:*` in Upstash Redis
9. 201 response to Dashboard → draft cleared from localStorage

**Draft autosave:** Every 5 seconds, dashboard persists editor state to `localStorage` (`lumea-draft`). Purged on successful publish.

---

## Recommendation & Trending Algorithms

### Trending Decay Formula
```
Score = (UniqueViews + (Likes × 5) + (Comments × 10)) / (HoursSincePublish + 2)^1.8
```
Executed as an OpenSearch aggregation (Analytics Service pre-aggregates engagement counts; Content Service runs the decay calculation). Fresh content cycles through the top every 24–48 hours.

### Personalized Recommendation Engine
Hybrid scoring for "Recommended For You" feed:
1. **Explicit interests** (+20 pts): Post `category` matches user's `interests` array
2. **Implicit behavior** (+10 pts): Post `category` matches user's top `UserAnalytics.categoryViews` entry (from Analytics Service)
3. **Engagement boost** (+Post engagement score × 0.2)

---

## Gamification & Monetization

### InkScore
Reputation metric, stored in MongoDB `ink_scores` collection (owned by Interaction Service):
- +1 per like received on any post
- +5 per post published
- +10 per donation received (future payment service)

### Badges
`evaluateWriterBadges()` and `evaluateReaderBadges()` triggered by Notification Service on each InkScore update. Fixed thresholds (e.g., 1,000 views = "Wordsmith", 10,000 views = "Top 1%").

### Supporter Tiers (INR)
| Tier | Threshold |
|---|---|
| BRONZE | > ₹0 and < ₹300 |
| SILVER | ≥ ₹300 |
| GOLD | ≥ ₹1,500 |
| PLATINUM | ≥ ₹15,000 |
| LIFETIME | ≥ ₹15,000 (no expiry) |

### Partner Program
Eligibility: ≥ 100 unique views + ≥ 10 followers → `is_partner` flips to `true` on `auth.users`. Writer earns 60% of each donation; Lumea retains 40% (LLM costs, infrastructure). (Payment Service implementation deferred.)

---

## Caching Strategy

| Tier | Mechanism | What's Cached |
|---|---|---|
| **Client** | TanStack Query `staleTime` + `SyncStoragePersister` | Profiles, categories, feeds — survives page unload for PWA offline mode |
| **Edge** | Upstash Redis (HTTP) | JWT blacklist, OTP state, feed query results, AI rate counters, AI response cache |
| **Database** | MongoDB compound indexes | Feed sort, post lookup by slug, user profile routing |
| **Search** | OpenSearch index | Full-text search — no MongoDB regex, relevance-ranked results |

---

## Key Data Flows

### Post Creation → Publication
```
Writer clicks Publish (Dashboard)
→ POST writer.lumea.ink/posts/{id}/publish
→ CF Worker Router: JWT verify (local) + Redis blacklist check
→ Post CF Worker:
    scanContent() → [violations] 422 with positions
    extract local <img> blobs
      → GET writer.lumea.ink/media/signed-url (Media CF Worker)
      → Browser uploads directly to Cloudinary
      → Swap src for CDN URL
    OWASP sanitize HTML
    Generate unique slug
    Save to MongoDB (status: PENDING_REVIEW)
→ 201 to Dashboard → clear localStorage draft
→ ASYNC: POST api.lumea.ink/internal/events { post.published }
    → Content Lambda: upsert to OpenSearch posts index
    → Content Lambda: DELETE feed_cache:* from Upstash Redis
    → Notification Lambda: fan-out to follower notification queue
```

### Authentication (OTP Registration)
```
Register form submit (Dashboard)
→ POST api.lumea.ink/api/auth/register
→ User-Auth Lambda: rate-limit check via Upstash Redis
→ Save OTP to Redis (otp:{email}, TTL 10min)
→ Fire email.transactional event → Communication Lambda → AWS SES
→ User enters 6-digit code → POST /api/auth/verify-otp
→ Redis OTP wiped, user created in PostgreSQL auth.users
→ JWT issued (HS256) → returned to client
→ Stored in localStorage + lumea-auth-token cookie
```

### Search Query
```
User searches "stoicism writing" (Main Portal)
→ GET api.lumea.ink/api/content/search?q=stoicism+writing
→ AWS API Gateway JWT authorizer (public route — no auth needed)
→ Content Lambda: query OpenSearch posts index
    BM25 relevance scoring on title + excerpt + content_text + tags
    Filter: status = PUBLISHED
    Return top 20 results with highlight snippets
→ 200 with ranked results
```

### Writer Analytics Request
```
Writer opens Analytics tab (Dashboard)
→ GET api.lumea.ink/api/analytics/writer
→ JWT Lambda authorizer validates token
→ Analytics Lambda: OpenSearch aggregation on analytics index
    Filter: post_id IN writer's posts
    Aggregate: total views, unique readers by day, avg reading time,
               referrer breakdown (top 5 sources), completion rate
→ 200 with pre-aggregated stats
```

### Real-time Chat
```
Open chat with a mutual follower (Main Portal)
→ POST /api/auth/chat-token (JWT required)
→ User-Auth Lambda: Firebase Admin SDK mints custom Firebase token linked to Lumea user ID
→ Client: signInWithCustomToken(token)
→ Firebase authenticated
→ RTDB: setStatus ONLINE + onDisconnect setStatus OFFLINE
→ Firestore: onSnapshot(chats/{chatId}/messages) — real-time delta stream
```

### AI Request (with Fallback)
```
Writer uses "Fix Grammar" (Dashboard editor)
→ POST api.lumea.ink/api/ai/fix-grammar
→ AWS API Gateway → HTTP proxy to Vercel AI Service
→ AI Service (FastAPI):
    Redis INCR ai_usage:{userId} (TTL 60s)
    [Count > 5] → 429 Too Many Requests
    Redis GET ai_cache:{promptHash}
    [Cache hit] → return cached response instantly
    [Cache miss] → round-robin Groq key selection
    [Groq 429] → fallback to OpenRouter
    [Success] → Redis SET ai_cache:{hash} TTL 24h
→ 200 OK with corrected text
```

---

## Admin Panel

Located at `/admin` in the Dashboard (`dash.lumea.ink`). Requires `ADMIN` role. Isolated via `lumea_admin_token` cookie — Dashboard Axios config switches tokens automatically on any `/admin` route.

| Tab | Function |
|---|---|
| `overview` | Platform metrics from Analytics Service: DAUs, total posts, active writers. Recharts visualizations. |
| `posts` | PENDING_REVIEW moderation queue from Post Service. Inline HTML preview. Approve (→ PUBLISHED + OpenSearch index) or Reject (→ `rejection_reason` shown to author). Hard-delete for DMCA. |
| `users` | Role assignment (USER → EDITOR/ADMIN). 3-strike system — auto-ban at 3 strikes + Redis blacklist all JTIs. Badge grants. Unban. |
| `reports` | Crowdsourced flags from Interaction Service. Target + reporter + reason. Dismiss or punitive action (delete + strike). |
| `categories` | Create/edit global categories. Managed via Post Service. Slug auto-generated. |
| `search` | OpenSearch index management: view index stats, trigger manual reindex, clear stale documents. |
| `communication` | Email log browser from Communication Service. Resend failed emails. Template management. |
| `maintenance` | Danger zone: sync author snapshots in MongoDB, flush Upstash Redis caches (panic button). |

---

## Firebase (Real-time Chat)

Firebase is used **exclusively** for real-time chat. All other data lives in the primary stores above.

| Firebase Service | Usage |
|---|---|
| **Firestore** | `chats/{chatId}/messages` — durable message payloads with reactions |
| **RTDB** | `status/{handle}` — Online/Offline presence; `typing/{chatId}/{handle}` — typing indicators |
| **Firebase Auth** | Validates Google OAuth tokens; issues custom tokens for chat identity bridge |

**Mutual Friendship Protection:** Chat is only possible between mutual followers. Chat IDs are deterministic: `[handle1, handle2].sort().join('_')` — zero lookup collision.

**Firestore vs RTDB Separation:**
- **Firestore:** Durable payloads (`authorId`, `text`, `createdAt`, `reactions`). `onSnapshot()` for real-time delta updates.
- **RTDB:** Ephemeral state only. `onDisconnect()` handlers auto-set OFFLINE on tab close.

---

## PWA & Offline Support

- Uses `@ducanh2912/next-pwa` on the Main Portal.
- Service Worker pre-caches core static assets and HTML templates.
- Offline fallback: uncached pages → custom `/offline` route.
- `<ConnectivityBanner />` listens to `navigator.onLine` API.
- **FCM Push:** Service Worker registers for Web Push at login. Notification Service sends FCM payloads for new likes, followers, and comments — delivered even when the browser is closed.

---

## Infrastructure & Deployment

### Environment Variables

**Main Portal (`lumea-main/.env.local`):**
```
NEXT_PUBLIC_API_URL=https://api.lumea.ink
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
UNSPLASH_ACCESS_KEY=...
```

**User-Auth Lambda:**
```
JWT_SECRET=...                          # HS256 dev / RS256 private key prod
POSTGRES_URL=...                        # Shared RDS instance
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_TOKEN=...
FIREBASE_ADMIN_CREDENTIALS=...          # JSON stringified service account
INTERNAL_SERVICE_TOKEN=...              # For service-to-service calls
```

**Content Lambda:**
```
MONGODB_URI=...
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_TOKEN=...
OPENSEARCH_URL=...
OPENSEARCH_USERNAME=...
OPENSEARCH_PASSWORD=...
INTERNAL_SERVICE_TOKEN=...
```

**Post CF Worker (Cloudflare Workers secrets):**
```
JWT_SECRET=...                          # Same as Auth Lambda
MONGODB_URI=...
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_TOKEN=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_CLOUD_NAME=...
INTERNAL_SERVICE_TOKEN=...
INTERNAL_EVENTS_URL=https://api.lumea.ink/internal/events
```

**AI Service (`ai-service/.env`):**
```
GROQ_API_KEY_1=...
GROQ_API_KEY_2=...
GROQ_API_KEY_3=...
OPENROUTER_API_KEY=...
COHERE_API_KEY=...
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_TOKEN=...
JWT_PUBLIC_KEY=...                      # For token verification
```

**Communication Lambda:**
```
POSTGRES_URL=...                        # Shared RDS instance (comms schema)
AWS_SES_REGION=ap-south-1
RESEND_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=...
```

### CI/CD

| App / Service | Trigger | Pipeline |
|---|---|---|
| Main Portal | Push to `main` → Cloudflare Pages auto-deploys | `next build` → CF Pages |
| Dashboard | Push to `main` → GitHub Actions | `next build (output: export)` → `aws s3 sync` → CloudFront invalidation |
| Lambda functions (Go/Hono) | Push to `main` → GitHub Actions | Build → `aws lambda update-function-code` (or AWS SAM) |
| Post/Media CF Workers | Push to `main` → GitHub Actions | `wrangler publish` |
| AI Service | Push to `main` → Vercel auto-deploys | Vercel build |

### Dashboard S3 + CloudFront Setup
```bash
# Build static export
cd lumea-dashboard
npm run build   # next.config.js: output: 'export'

# Deploy
aws s3 sync ./out s3://lumea-dashboard-static --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id XXXXXXXXXXXX \
  --paths "/*"
```

---

## Known Tech Debt & Planned Upgrades

| Issue | Current State | Fix |
|---|---|---|
| HS256 JWT | Development convenience | Upgrade to RS256 before production — Auth holds private key, distribute public key to all services |
| Post CF Worker → AWS event bridge | HTTP POST to internal Lambda on publish | Move to SNS/SQS when volume requires it |
| Social follow arrays in `auth.users` | O(1) mutual check; will breach limits at ~1M followers | Separate `follows` table in PostgreSQL |
| Author snapshot denormalization | Async repair job on profile update | Event-driven consumer off SNS |
| OpenSearch analytics rollover | Manual ILM policy setup needed | Automate ILM via CDK on provisioning |
| Interaction Service — nested comments | 2-level deep limit (parent + reply) | Extend to full adjacency list for deeper threads |
| Firebase message pagination | Full `onSnapshot()` on entire subcollection | `startAfter()` cursor pagination for > 5,000 messages |
| Dashboard Turborepo | Main portal + Dashboard are separate repos | Consolidate into Turborepo monorepo with shared `packages/ui` and `packages/types` |
