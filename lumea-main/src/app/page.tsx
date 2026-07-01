import { Suspense } from "react";
import { TopicPills } from "@/components/feed/TopicPills";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { PostCardSkeleton } from "@/components/feed/PostCard";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Topic filter */}
      <Suspense>
        <TopicPills />
      </Suspense>

      {/* Feed */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <HomeFeed />
      </Suspense>
    </div>
  );
}
