"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users, content } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PostCard } from "@/components/feed/PostCard";
import Image from "next/image";
import { UserPlus, UserMinus, Users } from "lucide-react";
import { use } from "react";

export default function AuthorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user: me, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => users.getPublicProfile(username).then(r => r.data),
  });

  const { data: postsData } = useQuery({
    queryKey: ["author-posts", username],
    queryFn: () => content.getAuthorPosts(username).then(r => r.data),
    enabled: !!profile,
  });

  const followMutation = useMutation({
    mutationFn: () => profile?.isFollowing ? users.unfollow(profile.id) : users.follow(profile.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", username] }),
  });

  if (isLoading) return <ProfileSkeleton />;
  if (!profile) return <div className="text-center py-16">User not found</div>;

  const isOwnProfile = me?.username === username;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Cover */}
      {profile.cover_image && (
        <div className="w-full h-40 rounded-2xl overflow-hidden mb-0 -mt-0">
          <Image src={profile.cover_image} alt="Cover" width={768} height={160} className="object-cover w-full h-full" />
        </div>
      )}

      {/* Avatar + info */}
      <div className="flex items-end gap-4 mb-6 mt-4">
        <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-zinc-200 shrink-0">
          {profile.profile_picture ? (
            <Image src={profile.profile_picture} alt={profile.name} width={80} height={80} className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-zinc-500">
              {profile.username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{profile.name ?? profile.username}</h1>
          <p className="text-zinc-400 text-sm">@{profile.username}</p>
        </div>
        {!isOwnProfile && isAuthenticated && (
          <button
            onClick={() => followMutation.mutate()}
            disabled={followMutation.isPending}
            className={profile.isFollowing ? "btn-outline gap-1" : "btn-primary gap-1"}
          >
            {profile.isFollowing ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
          </button>
        )}
      </div>

      {/* Bio */}
      {profile.bio && <p className="text-zinc-600 mb-4 leading-relaxed">{profile.bio}</p>}

      {/* Stats */}
      <div className="flex items-center gap-6 text-sm text-zinc-500 mb-8">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <strong className="text-zinc-900">{profile.followers_count}</strong> followers
        </div>
        <div>
          <strong className="text-zinc-900">{profile.following_count}</strong> following
        </div>
        <div>
          <strong className="text-zinc-900">{profile.ink_score ?? 0}</strong> InkScore
        </div>
      </div>

      {/* Posts */}
      <h2 className="font-semibold text-lg mb-4">Stories</h2>
      <div className="space-y-4">
        {(postsData?.data ?? []).map((post: any) => (
          <PostCard key={post.postId} post={post} />
        ))}
        {postsData?.data?.length === 0 && (
          <p className="text-zinc-400 text-sm py-8 text-center">No published stories yet.</p>
        )}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
      <div className="w-20 h-20 rounded-full bg-zinc-200 mb-4" />
      <div className="h-7 bg-zinc-200 rounded w-40 mb-2" />
      <div className="h-4 bg-zinc-200 rounded w-24 mb-6" />
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-zinc-200 rounded-xl mb-4" />)}
    </div>
  );
}
