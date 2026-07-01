"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Send, Clock, Eye, Sparkles, X, Upload } from "lucide-react";
import { DateTimePicker } from "react-smart-datetime";
import "react-smart-datetime/styles.css";
import { RichEditor } from "@/components/editor/RichEditor";
import { AIPanel } from "@/components/editor/AIPanel";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "write" | "settings" | "seo";

export default function PostEditorPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const isNew = postId === "new";
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("write");
  const [aiOpen, setAiOpen] = useState(false);
  const [saved, setSaved] = useState(true);

  // Post form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // Load existing post
  const { data: post } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => api.getPost(postId),
    enabled: !isNew,
  });

  useEffect(() => {
    if (post) {
      setTitle(post.title ?? "");
      setContent(post.content ?? "");
      setExcerpt(post.excerpt ?? "");
      setCoverImage(post.coverImage ?? "");
      setTags(post.tags ?? []);
      setScheduledAt(post.scheduledAt ? new Date(post.scheduledAt) : null);
      setMetaTitle(post.metaTitle ?? "");
      setMetaDescription(post.metaDescription ?? "");
    }
  }, [post]);

  // Autosave draft every 30s
  const saveDraft = useMutation({
    mutationFn: (data: object) =>
      isNew
        ? api.createPost({ ...data, status: "draft" })
        : api.updatePost(postId, data),
    onSuccess: (res: any) => {
      setSaved(true);
      if (isNew) router.replace(`/posts/${res.id}`);
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const publishPost = useMutation({
    mutationFn: () => {
      const data = { title, content, excerpt, coverImage, tags, metaTitle, metaDescription,
        status: scheduledAt ? "scheduled" : "published",
        scheduledAt: scheduledAt?.toISOString(),
      };
      return isNew ? api.createPost(data) : api.updatePost(postId, { ...data });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      router.push("/posts");
    },
  });

  const getFormData = useCallback(() => ({
    title, content, excerpt, coverImage, tags, metaTitle, metaDescription,
    scheduledAt: scheduledAt?.toISOString(),
  }), [title, content, excerpt, coverImage, tags, metaTitle, metaDescription, scheduledAt]);

  useEffect(() => {
    setSaved(false);
  }, [title, content, excerpt, tags]);

  useEffect(() => {
    if (saved) return;
    const t = setTimeout(() => saveDraft.mutate(getFormData()), 30_000);
    return () => clearTimeout(t);
  }, [saved, saveDraft, getFormData]);

  function addTag(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/,$/, "");
      if (t && !tags.includes(t) && tags.length < 5) {
        setTags((prev) => [...prev, t]);
      }
      setTagInput("");
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "write", label: "Write" },
    { id: "settings", label: "Settings" },
    { id: "seo", label: "SEO" },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main editor */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b border-border/60 bg-background/95 backdrop-blur">
          <div className="flex gap-1 p-0.5 rounded-lg bg-muted text-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  tab === t.id
                    ? "bg-background text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-muted-foreground mr-1">
              {saved ? "Saved" : "Unsaved changes"}
            </span>
            <button
              onClick={() => setAiOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors border",
                aiOpen ? "bg-accent border-accent-foreground/20" : "border-border hover:bg-accent/50"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </button>
            <button
              onClick={() => saveDraft.mutate(getFormData())}
              disabled={saveDraft.isPending}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-border hover:bg-accent/50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save draft
            </button>
            <button
              onClick={() => publishPost.mutate()}
              disabled={!title.trim() || publishPost.isPending}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {scheduledAt ? (
                <><Clock className="h-3.5 w-3.5" />Schedule</>
              ) : (
                <><Send className="h-3.5 w-3.5" />Publish</>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
          {/* WRITE TAB */}
          {tab === "write" && (
            <div className="space-y-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title…"
                className="w-full text-3xl font-bold tracking-tight bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 resize-none"
              />
              <RichEditor
                content={content}
                onChange={setContent}
                placeholder="Start writing your post…"
              />
            </div>
          )}

          {/* SETTINGS TAB */}
          {tab === "settings" && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold">Post settings</h2>

              {/* Cover image */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Cover image URL</label>
                <div className="flex gap-2">
                  <input
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    placeholder="https://res.cloudinary.com/…"
                    className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-sm text-muted-foreground hover:bg-accent/50 transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </button>
                </div>
                {coverImage && (
                  <img src={coverImage} alt="Cover preview" className="rounded-lg h-32 object-cover w-full" />
                )}
              </div>

              {/* Excerpt */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Excerpt</label>
                <textarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="A short summary shown in the post feed…"
                  rows={3}
                  maxLength={300}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{excerpt.length}/300</p>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags <span className="text-muted-foreground font-normal">(up to 5)</span></label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[42px] rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {t}
                      <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="hover:text-destructive">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  {tags.length < 5 && (
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                      placeholder={tags.length === 0 ? "Add tags… (press Enter)" : ""}
                      className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  )}
                </div>
              </div>

              {/* Schedule — react-smart-datetime */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Schedule publish time{" "}
                  <span className="text-muted-foreground font-normal">(leave empty to publish immediately)</span>
                </label>
                <DateTimePicker
                  mode="datetime"
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  placeholder="Pick a date & time…"
                  clearable
                  minDate={new Date()}
                  use24Hour
                  showTodayButton={false}
                  theme="auto"
                  closeOnSelect={false}
                />
                {scheduledAt && (
                  <p className="text-xs text-blue-600">
                    Will publish on {scheduledAt.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SEO TAB */}
          {tab === "seo" && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold">SEO & metadata</h2>

              <div className="space-y-2">
                <label className="text-sm font-medium">Meta title</label>
                <input
                  value={metaTitle || title}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={60}
                  placeholder={title || "Post title (used in search results)"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className={`text-xs text-right ${(metaTitle || title).length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                  {(metaTitle || title).length}/60
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Meta description</label>
                <textarea
                  value={metaDescription || excerpt}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  maxLength={160}
                  rows={3}
                  placeholder={excerpt || "Short description for search results (max 160 chars)"}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
                <p className={`text-xs text-right ${(metaDescription || excerpt).length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                  {(metaDescription || excerpt).length}/160
                </p>
              </div>

              {/* Google preview */}
              <div className="rounded-xl border border-border/60 p-4 space-y-1 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-2">Search preview</p>
                <p className="text-base text-blue-600 font-medium line-clamp-1">
                  {metaTitle || title || "Post title"}
                </p>
                <p className="text-xs text-green-700">
                  {process.env.NEXT_PUBLIC_MAIN_URL ?? "https://lumea.ink"}/you/{(title || "post-title").toLowerCase().replace(/\s+/g, "-")}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {metaDescription || excerpt || "Your post description will appear here."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI panel */}
      {aiOpen && (
        <AIPanel
          title={title}
          content={content}
          tags={tags}
          excerpt={excerpt}
          onClose={() => setAiOpen(false)}
          onApply={(field, value) => {
            if (field === "title")   setTitle(value);
            if (field === "excerpt") setExcerpt(value);
            if (field === "tags")    setTags(value.split(",").map((t: string) => t.trim()).slice(0, 5));
          }}
        />
      )}
    </div>
  );
}
