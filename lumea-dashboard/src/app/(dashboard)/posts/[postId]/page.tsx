"use client";
import { use, useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { postApi, mediaApi } from "@/lib/api";
import { uploadToCloudinary } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import Heading from "@tiptap/extension-heading";
import Blockquote from "@tiptap/extension-blockquote";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Underline from "@tiptap/extension-underline";
import History from "@tiptap/extension-history";
import Placeholder from "@tiptap/extension-placeholder";

import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { AIPanel } from "@/components/editor/AIPanel";
import {
  Save, Globe, EyeOff, Lock, Unlock, Image as ImageIcon,
  Sparkles, Maximize2, Minimize2, X, Tag, ChevronDown,
} from "lucide-react";

const CATEGORIES = ["Technology", "Science", "Writing", "Travel", "Food", "Health", "Finance", "Culture", "Opinion", "Other"];

export default function PostEditorPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const isNew = postId === "new";
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [savedPostId, setSavedPostId] = useState<string | null>(isNew ? null : postId);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load existing post
  const { data: postData } = useQuery({
    queryKey: ["post-edit", postId],
    queryFn: () => postApi.get(postId).then(r => r.data),
    enabled: !isNew,
  });

  // Editor
  const editor = useEditor({
    extensions: [
      Document, Paragraph, Text, Bold, Italic, Strike, Code, CodeBlock,
      Heading.configure({ levels: [1, 2, 3] }),
      Blockquote, BulletList, OrderedList, ListItem, Underline, HorizontalRule,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      History,
      Placeholder.configure({ placeholder: "Tell your story..." }),
    ],
    content: "",
    editorProps: { attributes: { class: "focus:outline-none" } },
  });

  // Populate editor when post loads
  useEffect(() => {
    if (postData && editor) {
      setTitle(postData.title ?? "");
      setTags(postData.tags ?? []);
      setCategory(postData.category ?? "");
      setCoverImage(postData.coverImage ?? null);
      setIsPremium(postData.isPremium ?? false);
      editor.commands.setContent(postData.content ?? "");
    }
  }, [postData, editor]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (publish = false) => {
      const content = editor?.getHTML() ?? "";
      const body = { title, content, tags, category, isPremium };
      if (savedPostId) {
        await postApi.update(savedPostId, body);
        if (publish) await postApi.publish(savedPostId);
        return savedPostId;
      } else {
        const res = await postApi.create(body);
        const id = res.data.postId;
        setSavedPostId(id);
        if (publish) await postApi.publish(id);
        router.replace(`/posts/${id}`);
        return id;
      }
    },
    onSuccess: () => setLastSaved(new Date()),
  });

  // Auto-save every 30s
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { if (title) saveMutation.mutate(false); }, 30_000);
  }, [title, saveMutation]);

  useEffect(() => { scheduleAutoSave(); }, [title, scheduleAutoSave]);

  // Cover image upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !savedPostId) return;
    const { data } = await mediaApi.getUploadUrl("covers");
    const url = await uploadToCloudinary(file, data);
    setCoverImage(url);
    await postApi.updateCover(savedPostId, url);
  };

  // Tag input
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const isPublished = postData?.status === "published";

  return (
    <div className={`flex flex-col h-screen ${zenMode ? "zen-mode" : ""}`}>
      {/* Top bar */}
      <div className="h-14 bg-white border-b border-zinc-200 flex items-center px-5 gap-3 shrink-0 z-30">
        <button onClick={() => router.push("/posts")} className="btn-ghost text-xs px-2 py-1.5">
          <X className="w-4 h-4" /> Close
        </button>
        <div className="flex-1" />

        {lastSaved && (
          <span className="text-xs text-zinc-400">
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}

        <button onClick={() => setShowAI(s => !s)}
          className={`btn-ghost text-xs px-3 py-1.5 ${showAI ? "bg-amber-50 text-amber-700" : ""}`}>
          <Sparkles className="w-4 h-4" /> AI
        </button>
        <button onClick={() => setZenMode(z => !z)} className="btn-ghost text-xs px-2 py-1.5">
          {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending}
          className="btn-outline text-xs py-1.5">
          <Save className="w-4 h-4" /> {saveMutation.isPending ? "Saving..." : "Save"}
        </button>
        <button onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending || isPublished}
          className="btn-primary text-xs py-1.5">
          <Globe className="w-4 h-4" /> {isPublished ? "Published" : "Publish"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {editor && <EditorToolbar editor={editor} />}

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-8">
              {/* Cover image */}
              <div className="mb-6">
                {coverImage ? (
                  <div className="relative group">
                    <img src={coverImage} alt="Cover" className="w-full h-52 object-cover rounded-xl" />
                    <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button onClick={() => coverInputRef.current?.click()} className="btn-outline text-white border-white text-xs">
                        Change cover
                      </button>
                      <button onClick={() => setCoverImage(null)} className="text-white text-xs hover:underline">Remove</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => savedPostId ? coverInputRef.current?.click() : saveMutation.mutate(false)}
                    className="flex items-center gap-2 text-zinc-300 hover:text-zinc-500 text-sm transition-colors">
                    <ImageIcon className="w-5 h-5" /> Add cover image
                  </button>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </div>

              {/* Title */}
              <textarea
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Story title..."
                rows={2}
                className="w-full text-4xl font-bold leading-tight resize-none border-0 outline-none bg-transparent placeholder:text-zinc-200 mb-4"
              />

              {/* Meta bar */}
              <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-zinc-100">
                {/* Category */}
                <div className="relative">
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="text-xs text-zinc-500 border border-zinc-200 rounded-lg pl-3 pr-7 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white">
                    <option value="">Category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" />
                </div>

                {/* Premium toggle */}
                <button onClick={() => setIsPremium(p => !p)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${isPremium ? "bg-amber-50 border-amber-200 text-amber-700" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                  {isPremium ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {isPremium ? "Premium" : "Free"}
                </button>

                {/* Tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs px-2 py-1 bg-zinc-100 rounded-full text-zinc-600">
                      {tag}
                      <button onClick={() => setTags(tags.filter(t => t !== tag))} className="text-zinc-400 hover:text-zinc-700">✕</button>
                    </span>
                  ))}
                  {tags.length < 5 && (
                    <div className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-zinc-300" />
                      <input
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                        onBlur={addTag}
                        placeholder="Add tag..."
                        className="text-xs border-0 outline-none w-20 placeholder:text-zinc-300"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Tiptap editor content */}
              {editor && (
                <div className="tiptap-editor">
                  <EditorContent editor={editor} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Side panel */}
        {showAI && (
          <AIPanel
            postTitle={title}
            postContent={editor?.getHTML() ?? ""}
            postTags={tags}
            onClose={() => setShowAI(false)}
          />
        )}
      </div>
    </div>
  );
}
