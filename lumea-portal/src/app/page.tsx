import { Suspense } from "react";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { TopicsSidebar } from "@/components/feed/TopicsSidebar";

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
      {/* Main feed */}
      <section className="flex-1 min-w-0">
        <Suspense fallback={<FeedSkeleton />}>
          <HomeFeed />
        </Suspense>
      </section>

      {/* Sidebar */}
      <aside className="hidden lg:block w-80 shrink-0">
        <Suspense fallback={null}>
          <TopicsSidebar />
        </Suspense>
      </aside>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-zinc-200 rounded-full" />
            <div className="h-4 bg-zinc-200 rounded w-32" />
          </div>
          <div className="h-6 bg-zinc-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-zinc-200 rounded w-full mb-1" />
          <div className="h-4 bg-zinc-200 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}
