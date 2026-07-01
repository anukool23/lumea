"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { DateTimePicker, type DateRange } from "react-smart-datetime";
import "react-smart-datetime/styles.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PostCard, PostCardSkeleton } from "@/components/feed/PostCard";
import { api } from "@/lib/api";

const POPULAR_TAGS = ["Technology", "Design", "Engineering", "Product", "Science", "Culture"];

function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const initialTag = params.get("tag") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [tag, setTag] = useState(initialTag);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [filtersOpen, setFiltersOpen] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const url = new URL("/search", window.location.origin);
    if (query.trim()) url.searchParams.set("q", query.trim());
    if (tag) url.searchParams.set("tag", tag);
    router.push(url.pathname + url.search);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["search", initialQ, initialTag, dateRange],
    queryFn: () =>
      api.searchPosts({
        q: initialQ || undefined,
        tag: initialTag || undefined,
        from: dateRange.start?.toISOString(),
        to: dateRange.end?.toISOString(),
      }),
    enabled: !!(initialQ || initialTag),
  });

  const posts = data?.posts ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-8">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts, authors, topics…"
            className="pl-9 h-10"
            autoFocus
          />
        </div>
        <Button type="submit" className="h-10 px-5">Search</Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label="Filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </form>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="rounded-xl border border-border/60 p-5 space-y-5 bg-muted/30">
          {/* Tag filter */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Topic
            </p>
            <div className="flex gap-2 flex-wrap">
              {POPULAR_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? "" : t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    tag === t
                      ? "bg-foreground text-background"
                      : "bg-background border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Date range filter — react-smart-datetime */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Published between
            </p>
            <DateTimePicker
              mode="date"
              range
              rangeValue={dateRange}
              onRangeChange={setDateRange}
              placeholder="Select date range…"
              clearable
              theme="auto"
              closeOnSelect
            />
          </div>
        </div>
      )}

      {/* Active filters */}
      {(initialTag || dateRange.start) && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {initialTag && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {initialTag}
              <button
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                onClick={() => { setTag(""); router.push(`/search${query ? `?q=${query}` : ""}`); }}
              >
                ×
              </button>
            </Badge>
          )}
          {dateRange.start && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {dateRange.start.toLocaleDateString()} – {dateRange.end?.toLocaleDateString() ?? "…"}
              <button
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                onClick={() => setDateRange({ start: null, end: null })}
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Results */}
      {!initialQ && !initialTag ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Start typing to search posts.</p>
          <div className="flex gap-2 flex-wrap justify-center mt-6">
            {POPULAR_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/search?tag=${t}`)}
                className="rounded-full px-3 py-1.5 text-sm bg-muted hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">No results found for &ldquo;{initialQ}&rdquo;.</p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground mb-6">
            {posts.length} result{posts.length !== 1 ? "s" : ""}
            {initialQ ? ` for "${initialQ}"` : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {posts.map((post: any) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
