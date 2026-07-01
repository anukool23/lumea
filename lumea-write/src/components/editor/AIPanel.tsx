"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, X, Loader2, ChevronRight, Lightbulb, BarChart2, AlignLeft } from "lucide-react";
import { api } from "@/lib/api";

type AIAction = "ideas" | "seo" | "summarize";

interface AIPanelProps {
  title: string;
  content: string;
  tags: string[];
  excerpt: string;
  onClose: () => void;
  onApply: (field: string, value: string) => void;
}

export function AIPanel({ title, content, tags, excerpt, onClose, onApply }: AIPanelProps) {
  const [action, setAction] = useState<AIAction | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = useMutation({
    mutationFn: async (a: AIAction) => {
      if (a === "ideas")     return api.aiGenerateIdeas({ topic: title, interests: tags, existing_titles: [title] });
      if (a === "seo")       return api.aiSEO({ title, content, tags, excerpt });
      if (a === "summarize") return api.aiSummarize({ content });
    },
    onSuccess: (data) => setResult(data),
  });

  function handleAction(a: AIAction) {
    setAction(a);
    setResult(null);
    run.mutate(a);
  }

  const actions = [
    { id: "ideas" as AIAction,     label: "Generate ideas",  icon: Lightbulb,  desc: "Get 5 new post ideas based on your interests" },
    { id: "seo" as AIAction,       label: "SEO analysis",    icon: BarChart2,  desc: "Analyse this post's SEO score and improvements" },
    { id: "summarize" as AIAction, label: "Summarize",       icon: AlignLeft,  desc: "Generate a concise excerpt from your content" },
  ];

  return (
    <aside className="w-80 shrink-0 border-l border-border/60 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        <button onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Action buttons */}
        {actions.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => handleAction(id)}
            disabled={run.isPending}
            className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-accent/30 ${action === id ? "border-primary/30 bg-accent/20" : "border-border/60"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
              {action === id && run.isPending && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
            </div>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </button>
        ))}

        {/* Results */}
        {result && (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/60 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Result
            </div>

            {/* Ideas */}
            {action === "ideas" && result.ideas && (
              <div className="divide-y divide-border/60">
                {result.ideas.map((idea: any, i: number) => (
                  <div key={i} className="p-3 space-y-1.5">
                    <p className="text-sm font-medium">{idea.title}</p>
                    <p className="text-xs text-muted-foreground">{idea.hook}</p>
                    {idea.outline?.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-0.5 pl-3 list-disc">
                        {idea.outline.map((s: string, j: number) => <li key={j}>{s}</li>)}
                      </ul>
                    )}
                    <button
                      onClick={() => onApply("title", idea.title)}
                      className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                    >
                      Use this title <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SEO */}
            {action === "seo" && (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-bold ${result.score >= 70 ? "text-emerald-600" : result.score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                    {result.score}
                  </div>
                  <div className="text-xs text-muted-foreground">SEO score</div>
                </div>
                {result.improvements?.map((s: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-amber-500 shrink-0">→</span>{s}
                  </p>
                ))}
                {result.meta_description && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Suggested meta description:</p>
                    <p className="text-xs text-muted-foreground">{result.meta_description}</p>
                    <button
                      onClick={() => onApply("excerpt", result.meta_description)}
                      className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                    >
                      Apply <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {result.keyword_suggestions?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Keyword suggestions:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.keyword_suggestions.map((k: string) => (
                        <button
                          key={k}
                          onClick={() => onApply("tags", k)}
                          className="rounded-full bg-secondary px-2 py-0.5 text-xs hover:bg-secondary/60 transition-colors"
                        >
                          + {k}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Summarize */}
            {action === "summarize" && result.summary && (
              <div className="p-3 space-y-2">
                <p className="text-sm leading-relaxed">{result.summary}</p>
                <button
                  onClick={() => onApply("excerpt", result.summary)}
                  className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                >
                  Use as excerpt <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
