"use client";
import { type Editor } from "@tiptap/react";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  Quote, List, ListOrdered, Link2, Image, Table2, Minus,
  Undo, Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { editor: Editor }

export function EditorToolbar({ editor }: Props) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const tools = [
    { icon: Undo, action: () => editor.chain().focus().undo().run(), disabled: !editor.can().undo(), title: "Undo" },
    { icon: Redo, action: () => editor.chain().focus().redo().run(), disabled: !editor.can().redo(), title: "Redo" },
    null,
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), title: "Bold" },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), title: "Italic" },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike"), title: "Strikethrough" },
    { icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive("code"), title: "Inline code" },
    null,
    { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive("heading", { level: 1 }), title: "H1" },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }), title: "H2" },
    { icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive("heading", { level: 3 }), title: "H3" },
    null,
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote"), title: "Blockquote" },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList"), title: "Bullet list" },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList"), title: "Numbered list" },
    null,
    { icon: Link2, action: setLink, active: editor.isActive("link"), title: "Link" },
    { icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), title: "Divider" },
    {
      icon: Table2,
      action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      title: "Insert table",
    },
  ];

  return (
    <div className="flex items-center flex-wrap gap-0.5 p-2 border-b border-zinc-200 bg-white sticky top-14 z-20">
      {tools.map((tool, i) => {
        if (tool === null) return <div key={i} className="w-px h-5 bg-zinc-200 mx-1" />;
        const { icon: Icon, action, active, disabled, title } = tool;
        return (
          <button
            key={i}
            type="button"
            onClick={action}
            disabled={disabled}
            title={title}
            className={cn(
              "p-1.5 rounded transition-colors text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100",
              active && "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white",
              disabled && "opacity-30 cursor-not-allowed"
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
