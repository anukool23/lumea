"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import Blockquote from "@tiptap/extension-blockquote";
import Heading from "@tiptap/extension-heading";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import History from "@tiptap/extension-history";
import {
  Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon,
  Strikethrough, Code as CodeIcon, Heading2, Heading3, List, ListOrdered,
  Quote, Minus, Link as LinkIcon, Image as ImageIcon, Undo, Redo,
} from "lucide-react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichEditor({ content, onChange, placeholder = "Start writing…" }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      Document, Paragraph, Text, History,
      Bold, Italic, Underline, Strike, Code, CodeBlock,
      Blockquote, HorizontalRule,
      Heading.configure({ levels: [1, 2, 3] }),
      BulletList, OrderedList, ListItem,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "ProseMirror" },
    },
  });

  if (!editor) return null;

  const ToolButton = ({
    onClick,
    active = false,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`h-7 w-7 inline-flex items-center justify-center rounded transition-colors ${
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  function setLink() {
    if (!editor) return;
    const url = prompt("Enter URL");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  function insertImage() {
    if (!editor) return;
    const url = prompt("Enter image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }

  return (
    <div className="flex flex-col border border-input rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-border/60 bg-muted/30">
        <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <BoldIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <ItalicIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="h-3.5 w-3.5" />
        </ToolButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
          <CodeIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider">
          <Minus className="h-3.5 w-3.5" />
        </ToolButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolButton onClick={setLink} active={editor.isActive("link")} title="Insert link">
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={insertImage} active={false} title="Insert image">
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolButton onClick={() => editor.chain().focus().undo().run()} active={false} title="Undo">
          <Undo className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().redo().run()} active={false} title="Redo">
          <Redo className="h-3.5 w-3.5" />
        </ToolButton>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="px-5 py-4 min-h-[400px] focus-within:outline-none"
      />
    </div>
  );
}
