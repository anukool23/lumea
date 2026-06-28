"use client";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { authApi, mediaApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { uploadToCloudinary } from "@/lib/utils";
import Image from "next/image";
import { Camera, Save } from "lucide-react";

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore() as any;
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: user?.name?.split(" ")[0] ?? "",
    last_name: user?.name?.split(" ").slice(1).join(" ") ?? "",
    bio: user?.bio ?? "",
    tagline: user?.tagline ?? "",
    website: user?.website ?? "",
    twitter: user?.twitter ?? "",
  });
  const [saved, setSaved] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile(form),
    onSuccess: (res) => {
      updateUser(res.data.user ?? res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data } = await mediaApi.getUploadUrl("avatars");
    const url = await uploadToCloudinary(file, data);
    await authApi.updateAvatar(url);
    updateUser({ profile_picture: url });
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* Avatar */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold mb-4">Profile photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-200">
              {user?.profile_picture
                ? <Image src={user.profile_picture} alt={user.username} width={80} height={80} className="object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-zinc-500">
                    {user?.username?.[0]?.toUpperCase()}
                  </div>
              }
            </div>
            <button onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-zinc-700 transition-colors">
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium">@{user?.username}</p>
            <p className="text-xs text-zinc-400 mt-0.5">InkScore: {user?.ink_score ?? 0}</p>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </div>
      </div>

      {/* Profile info */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold mb-4">Profile information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">First name</label>
              <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Last name</label>
              <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tagline</label>
            <input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              placeholder="What you write about in one line..."
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Bio</label>
            <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              rows={3} placeholder="Tell readers about yourself..."
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Website</label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Twitter / X</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
                <input value={form.twitter} onChange={e => setForm(f => ({ ...f, twitter: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
            className="btn-primary">
            <Save className="w-4 h-4" /> {updateMutation.isPending ? "Saving..." : "Save changes"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>

      {/* Account info */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Username</span>
            <span className="font-medium">@{user?.username}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Role</span>
            <span className="font-medium capitalize">{user?.role}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Supporter</span>
            <span className={`font-medium ${user?.supporter_status !== "NONE" ? "text-amber-600" : "text-zinc-400"}`}>
              {user?.supporter_status ?? "NONE"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
