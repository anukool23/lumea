"use client";
import { useState } from "react";
import { Sparkles, Lightbulb, Search, X, ChevronRight } from "lucide-react";
import { aiApi } from "@/lib/api";

interface Props {
  postTitle: string;
  postContent: string;
  postTags: string[];
  onClose: () => void;
}

type AITab = "ideas" | "seo";

export function AIPanel({ postTitle, postContent, postTags, onClose }: Props) {
  const [tab, setTab] = useState<AITab>("seo");
  const [loading, setLoading] = useState(false);
  const [seoResult, setSeoResult] = useState<any>(null);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [error, setError] = useState("");

  const runSEO = async () => {
    setLoading(true); setError("");
    try {
      const res = await aiApi.seoAnalysis({ title: postTitle, content: postContent, tags: postTags });
      setSeoResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Analysis failed");
    } finally { setLoading(false); }
  };

  const runIdeas = async () => {
    setLoading(true); setError("");
    try {
      const res = await aiApi.generateIdeas({ topic: postTitle });
      setIdeas(res.data.ideas ?? []);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Idea generation failed (daily limit may be reached)");
    } finally { setLoading(false); }
  };

  return (
    <div className="w-80 border-l border-zinc-200 bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-sm">AI Tools</h3>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-100">
        <button onClick={() => setTab("seo")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${tab === "seo" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400"}`}>
          <Search className="w-3.5 h-3.5" /> SEO Analysis
        </button>
        <button onClick={() => setTab("ideas")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${tab === "ideas" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400"}`}>
          <Lightbulb className="w-3.5 h-3.5" /> Ideas
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</div>}

        {tab === "seo" && (
          <div>
            <p className="text-xs text-zinc-400 mb-4">Analyze your post for SEO quality and keyword opportunities.</p>
            <button onClick={runSEO} disabled={loading || !postTitle} className="btn-primary w-full justify-center text-xs py-2 mb-4">
              {loading ? "Analyzing..." : "Run SEO Analysis"}
            </button>
            {seoResult && (
              <div className="space-y-4">
                {/* Score ring */}
                <div className="text-center py-4">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-4 text-2xl font-bold ${seoResult.score >= 70 ? "border-green-400 text-green-600" : seoResult.score >= 40 ? "border-amber-400 text-amber-600" : "border-red-400 text-red-600"}`}>
                    {seoResult.score}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">SEO Score</p>
                </div>
                {/* Meta description */}
                {seoResult.meta_description && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-1">Suggested meta description</p>
                    <p className="text-xs text-zinc-700 bg-zinc-50 rounded p-2 leading-relaxed">{seoResult.meta_description}</p>
                  </div>
                )}
                {/* Keywords */}
                {seoResult.keyword_suggestions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-2">Target keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {seoResult.keyword_suggestions.map((k: string) => (
                        <span key={k} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Improvements */}
                {seoResult.improvements?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 mb-2">Improvements</p>
                    <ul className="space-y-2">
                      {seoResult.improvements.map((imp: string, i: number) => (
                        <li key={i} className="flex gap-2 text-xs text-zinc-600">
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "ideas" && (
          <div>
            <p className="text-xs text-zinc-400 mb-1">Generate new story ideas based on your current topic.</p>
            <p className="text-xs text-zinc-300 mb-4">Limit: 2/day on free plan.</p>
            <button onClick={runIdeas} disabled={loading} className="btn-primary w-full justify-center text-xs py-2 mb-4">
              {loading ? "Generating..." : "Generate 5 ideas"}
            </button>
            {ideas.length > 0 && (
              <div className="space-y-4">
                {ideas.map((idea: any, i: number) => (
                  <div key={i} className="border border-zinc-200 rounded-lg p-3">
                    <p className="text-sm font-semibold mb-1">{idea.title}</p>
                    <p className="text-xs text-zinc-500 mb-2">{idea.hook}</p>
                    {idea.outline?.length > 0 && (
                      <ul className="space-y-0.5">
                        {idea.outline.map((section: string, j: number) => (
                          <li key={j} className="text-xs text-zinc-400 flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-zinc-200 flex items-center justify-center text-[9px]">{j + 1}</span>
                            {section}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
