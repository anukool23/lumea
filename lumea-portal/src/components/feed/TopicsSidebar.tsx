"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { content, users } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import Image from "next/image";

export function TopicsSidebar() {
  const { isAuthenticated } = useAuthStore();

  const { data: tagsData } = useQuery({
    queryKey: ["popular-tags"],
    queryFn: () => content.getPopularTags().then(r => r.data as { tag: string; count: number }[]),
    staleTime: 300_000,
  });

  const { data: suggestedData } = useQuery({
    queryKey: ["suggested-users"],
    queryFn: () => users.getSuggested().then(r => r.data as any[]),
    enabled: isAuthenticated,
  });

  return (
    <div className="space-y-8 sticky top-20">
      {/* Discover topics */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Discover topics</h3>
        <div className="flex flex-wrap gap-2">
          {(tagsData ?? []).slice(0, 12).map(({ tag }) => (
            <Link key={tag} href={`/?tag=${tag}`}
              className="px-3 py-1.5 bg-zinc-100 rounded-full text-sm text-zinc-700 hover:bg-zinc-200 transition-colors">
              {tag}
            </Link>
          ))}
        </div>
      </div>

      {/* Suggested writers */}
      {isAuthenticated && suggestedData && suggestedData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Writers to follow</h3>
          <div className="space-y-4">
            {suggestedData.slice(0, 5).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3">
                <Link href={`/u/${u.username}`}>
                  {u.profile_picture ? (
                    <Image src={u.profile_picture} alt={u.username} width={36} height={36} className="rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center text-sm font-medium">
                      {u.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/u/${u.username}`} className="text-sm font-medium hover:underline truncate block">{u.name ?? u.username}</Link>
                  <p className="text-xs text-zinc-400 truncate">{u.tagline ?? `@${u.username}`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-zinc-400">
        © {new Date().getFullYear()} Lumea · <Link href="/about" className="hover:underline">About</Link> · <Link href="/terms" className="hover:underline">Terms</Link>
      </p>
    </div>
  );
}
