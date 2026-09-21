"use client";

import { useState, useEffect } from "react";
import { Sparkles, ThumbsUp, ThumbsDown, Quote, Globe, Loader2, MessageSquare } from "lucide-react";
import { ReviewSummaryResponse } from "@/types";
import { api } from "@/lib/api";

interface ReviewSummaryProps {
  hotelId: string;
}

export function ReviewSummary({ hotelId }: ReviewSummaryProps) {
  const [summary, setSummary] = useState<ReviewSummaryResponse | null>(null);
  const [language, setLanguage] = useState("en-IN");
  const [loading, setLoading] = useState(true);
  const [activeSnippet, setActiveSnippet] = useState<{ id: string; text: string } | null>(null);

  const fetchSummary = async (lang: string) => {
    setLoading(true);
    try {
      const data = await api.getReviewSummary(hotelId, lang);
      setSummary(data);
    } catch (err) {
      console.error("Failed to load review summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(language);
  }, [hotelId, language]);

  return (
    <div className="bg-gradient-to-br from-indigo-50/50 via-white to-amber-50/30 rounded-3xl p-6 sm:p-8 border border-brand-100 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-extrabold text-xl text-slate-900">
                AI Review Insights
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Gemini Synthesised
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Distilled from 25+ real multilingual guest reviews with strict citations
            </p>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Globe className="w-4 h-4 text-slate-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={loading}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="en-IN">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="bn">বাংলা (Bengali)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
          <p className="text-xs font-semibold">Gemini is synthesising multilingual guest reviews...</p>
        </div>
      ) : summary ? (
        <div className="mt-6 space-y-6">
          {/* Overall Sentiment */}
          {summary.overall && (
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs flex items-start gap-3">
              <Quote className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-slate-800 italic">
                "{summary.overall}"
              </p>
            </div>
          )}

          {/* Pros & Cons Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pros */}
            <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200/70">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-4">
                <ThumbsUp className="w-4 h-4 text-emerald-600" />
                <span>What Guests Loved</span>
              </div>
              <ul className="space-y-3">
                {summary.pros.map((pro, idx) => (
                  <li key={idx} className="text-xs text-slate-700 flex flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span className="font-semibold text-slate-800">{pro.text}</span>
                    </div>
                    {/* Citations */}
                    {pro.citations && pro.citations.length > 0 && (
                      <div className="flex items-center gap-1.5 ml-3.5 flex-wrap">
                        {pro.citations.map((c, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() =>
                              setActiveSnippet({ id: c.review_id, text: c.snippet })
                            }
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-md transition flex items-center gap-1"
                          >
                            <MessageSquare className="w-2.5 h-2.5" />
                            {c.review_id}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="bg-rose-50/50 rounded-2xl p-5 border border-rose-200/70">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-sm mb-4">
                <ThumbsDown className="w-4 h-4 text-rose-600" />
                <span>Things to Keep in Mind</span>
              </div>
              <ul className="space-y-3">
                {summary.cons.map((con, idx) => (
                  <li key={idx} className="text-xs text-slate-700 flex flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                      <span className="font-semibold text-slate-800">{con.text}</span>
                    </div>
                    {/* Citations */}
                    {con.citations && con.citations.length > 0 && (
                      <div className="flex items-center gap-1.5 ml-3.5 flex-wrap">
                        {con.citations.map((c, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() =>
                              setActiveSnippet({ id: c.review_id, text: c.snippet })
                            }
                            className="text-[10px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-2 py-0.5 rounded-md transition flex items-center gap-1"
                          >
                            <MessageSquare className="w-2.5 h-2.5" />
                            {c.review_id}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Active Citation Quote Popup */}
          {activeSnippet && (
            <div className="p-4 rounded-2xl bg-white border border-slate-300 shadow-md flex items-start justify-between gap-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <Quote className="w-4 h-4 text-brand-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-brand-700 uppercase tracking-wider mb-1">
                    Verified Guest Review ({activeSnippet.id})
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    "{activeSnippet.text}..."
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSnippet(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-1"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
