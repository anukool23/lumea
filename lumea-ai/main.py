"""
Lumea AI Service — FastAPI + litellm
Deployed on Vercel (serverless Python)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
from typing import Optional

import litellm
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel
from upstash_redis import Redis

load_dotenv()

# ── Structured JSON logger ────────────────────────────────────────────────────

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        log: dict = {
            "@timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level":   record.levelname.lower(),
            "service": "lumea-ai",
            "msg":     record.getMessage(),
        }
        if record.exc_info:
            log["exc"] = self.formatException(record.exc_info)
        return json.dumps(log)

def _build_logger() -> logging.Logger:
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    log = logging.getLogger("lumea-ai")
    log.setLevel(logging.DEBUG if os.getenv("NODE_ENV") != "production" else logging.INFO)
    log.addHandler(handler)
    log.propagate = False
    return log

logger = _build_logger()

# ── litellm model cascade (Groq → OpenRouter → Cohere) ───────────────────────

MODELS = [
    "groq/llama-3.1-70b-versatile",
    "openrouter/meta-llama/llama-3.1-70b-instruct",
    "command-r-plus",  # Cohere fallback
]

def _get_api_key(model: str) -> str:
    if "groq" in model:
        return os.getenv("GROQ_API_KEY", "")
    if "openrouter" in model:
        return os.getenv("OPENROUTER_API_KEY", "")
    return os.getenv("COHERE_API_KEY", "")

def llm_call(messages: list, max_tokens: int = 1024) -> str:
    """Try each model in cascade until one succeeds."""
    for model in MODELS:
        try:
            resp = litellm.completion(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.7,
                api_key=_get_api_key(model),
            )
            content = resp.choices[0].message.content or ""
            logger.info(f"llm_call model={model} max_tokens={max_tokens}")
            return content
        except Exception as e:
            logger.warning(f"llm_call model={model} failed: {e}")
    raise HTTPException(status_code=503, detail="All AI providers unavailable")

# ── Upstash Redis (HTTP REST — works on Vercel serverless) ───────────────────

_redis: Optional[Redis] = None

def get_redis() -> Redis:
    global _redis
    if not _redis:
        _redis = Redis(
            url=os.getenv("UPSTASH_REDIS_URL", ""),
            token=os.getenv("UPSTASH_REDIS_TOKEN", ""),
        )
    return _redis

# ── Rate limiting ─────────────────────────────────────────────────────────────

DAILY_LIMITS: dict[str, int] = {
    "generate_ideas": 2,
    "seo_analysis":   5,
    "summarize":      10,
}

def consume_quota(user_id: str, action: str) -> None:
    r = get_redis()
    key = f"ai_usage:{user_id}:{action}:{time.strftime('%Y-%m-%d')}"
    current = int(r.get(key) or 0)
    limit = DAILY_LIMITS.get(action, 5)
    if current >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily {action} limit ({limit}) reached. Resets at midnight UTC."
        )
    r.incr(key)
    r.expire(key, 86400)

def _usage_for(user_id: str, action: str) -> dict:
    r = get_redis()
    key = f"ai_usage:{user_id}:{action}:{time.strftime('%Y-%m-%d')}"
    used = int(r.get(key) or 0)
    limit = DAILY_LIMITS.get(action, 5)
    return {"used": used, "limit": limit, "remaining": max(0, limit - used)}

# ── Auth helpers ──────────────────────────────────────────────────────────────

def verify_api_key(x_api_key: str = Header(default="")) -> None:
    """Validate X-API-Key. Skipped if API_KEYS not set (local dev)."""
    raw = os.getenv("API_KEYS", "")
    if not raw:
        return
    valid = set(raw.split("-"))
    if x_api_key not in valid:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

def verify_jwt(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    token = authorization[7:]
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid token")
    h, p, s = parts
    secret = os.getenv("JWT_SECRET", "")
    try:
        sig = base64.urlsafe_b64decode(s + "==")
        expected = hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            raise HTTPException(status_code=401, detail="Invalid token signature")
        payload = json.loads(base64.urlsafe_b64decode(p + "=="))
        if payload.get("exp", 0) < time.time():
            raise HTTPException(status_code=401, detail="Token expired")
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Lumea AI Service",
    description="AI-powered features: idea generation, SEO analysis, and post summarization.",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

_allowed_origins = (
    os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,https://lumea.ink,https://dash.lumea.ink",
    ).split(",")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
)

# ── Request models ────────────────────────────────────────────────────────────

class IdeaRequest(BaseModel):
    topic: Optional[str] = None
    interests: list[str] = []
    existing_titles: list[str] = []

class SEORequest(BaseModel):
    title: str
    content: str
    tags: list[str] = []
    excerpt: Optional[str] = None

class SummarizeRequest(BaseModel):
    content: str
    max_length: int = 150

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "lumea-ai", "version": "1.0.0"}

@app.post("/api/ai/generate-ideas", tags=["AI"])
def generate_ideas(
    req: IdeaRequest,
    _: None = Depends(verify_api_key),
    user: dict = Depends(verify_jwt),
):
    """Generate blog post ideas. Limit: 2/day per user."""
    consume_quota(user["user_id"], "generate_ideas")

    interests_str = ", ".join(req.interests[:10]) if req.interests else "general writing"
    existing = "\n".join(f"- {t}" for t in req.existing_titles[:10])

    prompt = f"""Generate 5 unique, compelling blog post ideas for a writer interested in: {interests_str}.
Topic hint: {req.topic or 'any relevant topic'}

Already written (avoid similar):
{existing or 'None'}

Return a JSON array of 5 objects with keys:
- title (string)
- hook (string, 1 sentence why readers will care)
- outline (array of 3 section headings)

Respond with ONLY the JSON array, no markdown."""

    raw = llm_call([{"role": "user", "content": prompt}], max_tokens=800)

    try:
        match = re.search(r'\[[\s\S]*\]', raw)
        ideas = json.loads(match.group() if match else raw)
    except Exception:
        ideas = [{"title": raw, "hook": "", "outline": []}]

    logger.info(f"generate_ideas user={user['user_id']} count={len(ideas)}")
    return {"ideas": ideas[:5], "generated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ')}

@app.post("/api/ai/seo-analysis", tags=["AI"])
def seo_analysis(
    req: SEORequest,
    _: None = Depends(verify_api_key),
    user: dict = Depends(verify_jwt),
):
    """Analyse a post for SEO quality. Limit: 5/day."""
    consume_quota(user["user_id"], "seo_analysis")

    clean = re.sub(r'<[^>]+>', ' ', req.content)
    clean = re.sub(r'\s+', ' ', clean).strip()
    word_count = len(clean.split())

    prompt = f"""Analyze this blog post for SEO and return a JSON object with these exact keys:
- score: integer 0-100
- title_score: integer 0-100 (40-60 chars ideal, contains primary keyword)
- readability_score: integer 0-100
- keyword_suggestions: array of 5 strings
- meta_description: string (max 160 chars)
- improvements: array of 3 actionable strings
- estimated_read_time: integer (minutes)

Title: {req.title}
Word count: {word_count}
Tags: {', '.join(req.tags)}
Excerpt: {req.excerpt or 'None'}
Content (first 500 chars): {clean[:500]}

Respond with ONLY the JSON object, no markdown."""

    raw = llm_call([{"role": "user", "content": prompt}], max_tokens=600)

    try:
        match = re.search(r'\{[\s\S]*\}', raw)
        result = json.loads(match.group() if match else raw)
    except Exception:
        result = {"score": 0, "improvements": [raw]}

    result["word_count"] = word_count
    logger.info(f"seo_analysis user={user['user_id']} title='{req.title}'")
    return result

@app.post("/api/ai/summarize", tags=["AI"])
def summarize_post(
    req: SummarizeRequest,
    _: None = Depends(verify_api_key),
    user: dict = Depends(verify_jwt),
):
    """Generate a concise post summary. Limit: 10/day."""
    consume_quota(user["user_id"], "summarize")

    clean = re.sub(r'<[^>]+>', ' ', req.content)
    clean = re.sub(r'\s+', ' ', clean).strip()[:3000]

    prompt = f"""Summarize the following blog post in {req.max_length} words or less.
Write in a clear, engaging style. Start directly — no preamble.

{clean}"""

    summary = llm_call([{"role": "user", "content": prompt}], max_tokens=300)
    logger.info(f"summarize user={user['user_id']}")
    return {"summary": summary.strip()}

@app.get("/api/ai/usage", tags=["AI"])
def get_usage(
    _: None = Depends(verify_api_key),
    user: dict = Depends(verify_jwt),
):
    """Get the authenticated user's daily AI usage."""
    usage = {action: _usage_for(user["user_id"], action) for action in DAILY_LIMITS}
    return {"usage": usage, "reset_at": "midnight UTC"}

# ── Lambda handler ────────────────────────────────────────────────────────────

handler = Mangum(app, lifespan="off")
