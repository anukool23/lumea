"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TOPICS = [
  "All",
  "Technology",
  "Design",
  "Engineering",
  "Product",
  "Science",
  "Culture",
  "Business",
  "Health",
  "Finance",
];

export function TopicPills() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("topic") ?? "All";

  function handleClick(topic: string) {
    const url = topic === "All" ? "/" : `/?topic=${encodeURIComponent(topic)}`;
    router.push(url);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
      {TOPICS.map((topic) => (
        <button
          key={topic}
          onClick={() => handleClick(topic)}
          className={cn(
            "whitespace-nowrap shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === topic
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {topic}
        </button>
      ))}
    </div>
  );
}
