"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { content } from "@/lib/api";
import { PostCard } from "@/components/feed/PostCard";
import { Search, X } from "lucide-react";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [input, setInput] = useState(q);

  const { data, isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: () => content.search(q).then(r => r.data),
    enabled: q.length >= 2,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setQ(input.trim());
      router.push(`/search?q=${encodeURIComponent(input.trim())}`, { scroll: false });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <form onSubmit={handleSearch} className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Search stories, writers, topics..."
          className="w-full border border-zinc-200 rounded-xl pl-12 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
          autoFocus
        />
        {input && (
          <button type="button" onClick={() => { setInput(""); setQ(""); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {q.length >= 2 && (
        <>
          <p className="text-sm text-zinc-400 mb-4">
            {isLoading ? "Searching..." : `${data?.total ?? 0} results for "${q}"`}
          </p>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-6 animate-pulse h-32" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(data?.data ?? []).map((post: any) => (
                <PostCard key={post.postId} post={post} />
              ))}
              {data?.data?.length === 0 && (
                <div className="text-center py-16 text-zinc-400">
                  <p className="text-lg mb-2">No results found</p>
                  <p className="text-sm">Try different keywords or browse trending stories</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {q.length < 2 && (
        <div className="text-center py-16 text-zinc-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Type at least 2 characters to search</p>
        </div>
      )}
    </div>
  );
}
