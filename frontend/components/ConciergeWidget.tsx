"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  X,
  Bot,
  ShieldCheck,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Dog,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import { FeasibilityRequest, FeasibilityResponse } from "@/types";

interface ConciergeWidgetProps {
  hotelId: string;
  hotelName: string;
}

interface Message {
  role: "guest" | "concierge";
  content: string;
  sources?: string[];
  suggestedQuestions?: string[];
}

export function ConciergeWidget({ hotelId, hotelName }: ConciergeWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "simulator">("chat");

  // Chat State
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "concierge",
      content: `Namaste! I am the virtual concierge for ${hotelName}. Ask me anything about our policies, check-in, dining, or amenities.`,
      suggestedQuestions: [
        "Are pets allowed?",
        "What is the check-in time?",
        "Is there an airport pickup service?",
      ],
    },
  ]);

  // Policy Simulator State
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<FeasibilityResponse | null>(null);
  const [activeScenarioLabel, setActiveScenarioLabel] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeTab]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText !== undefined ? questionText : input).trim();
    if (!q || loading) return;

    setInput("");
    const newHistory: Message[] = [...messages, { role: "guest", content: q }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const historyPayload = newHistory
        .filter((m) => m.role === "guest")
        .map((m, idx) => ({
          question: m.content,
          answer: newHistory[idx * 2 + 1]?.content || "",
        }));

      const res = await api.askConcierge({
        hotel_id: hotelId,
        question: q,
        conversation_history: historyPayload,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "concierge",
          content: res.answer,
          sources: res.sources,
          suggestedQuestions: res.suggested_questions,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "concierge",
          content:
            "Sorry, I am having trouble contacting the hotel database right now. Please try again shortly.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Run Edge-Case Policy Simulation
  const runSimulation = async (scenarioName: string, payload: FeasibilityRequest) => {
    setActiveScenarioLabel(scenarioName);
    setSimLoading(true);
    try {
      const result = await api.checkHotelFeasibility(hotelId, payload);
      setSimResult(result);
    } catch (err) {
      console.error("Policy simulation failed:", err);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 px-5 py-3.5 rounded-full bg-gradient-to-r from-brand-600 via-indigo-600 to-amber-500 text-white font-bold text-sm shadow-glow hover:scale-105 transition-transform flex items-center gap-2.5 group"
        >
          <Sparkles className="w-4 h-4 animate-pulse text-amber-300" />
          <span>Ask Concierge & Policies</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      )}

      {/* Main Floating Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-md sm:max-w-lg h-[620px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-brand-900 via-indigo-950 to-slate-900 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-400 flex items-center justify-center text-white shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-heading font-bold text-sm">Property Concierge</h4>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Zero Hallucination
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-medium truncate max-w-[240px]">
                    {hotelName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="mt-3 grid grid-cols-2 p-1 bg-white/10 rounded-2xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === "chat"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("simulator");
                  if (!simResult && !simLoading) {
                    // Pre-run late arrival scenario by default
                    runSimulation("Late Arrival (2:30 AM)", {
                      arrival_time: "02:30",
                      has_pets: false,
                      children_ages: [],
                      adults_count: 2,
                    });
                  }
                }}
                className={`py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === "simulator"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Policy Simulator</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Chat Mode */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {/* Fast Travel Scenario Banner */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-xs text-amber-950 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold">Edge-Case Travel Constraints?</p>
                      <p className="text-[10px] text-amber-800">
                        Test late 2:30 AM arrival, pets, or child age rules.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("simulator");
                      runSimulation("Late Arrival (2:30 AM)", {
                        arrival_time: "02:30",
                        has_pets: false,
                        children_ages: [],
                        adults_count: 2,
                      });
                    }}
                    className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-[10px] shadow-sm transition"
                  >
                    Test Policy
                  </button>
                </div>

                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === "guest" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                        m.role === "guest"
                          ? "bg-brand-600 text-white rounded-tr-none shadow-sm"
                          : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs"
                      }`}
                    >
                      <p>{m.content}</p>

                      {/* Sources citation badges */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1 flex-wrap">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span className="text-[10px] font-semibold text-slate-400">
                            Verified from:
                          </span>
                          {m.sources.map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600"
                            >
                              {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Suggested Follow-up Questions */}
                    {m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
                      <div className="mt-2 space-y-1 w-full pl-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Suggested questions:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.suggestedQuestions.map((sq, sqIdx) => (
                            <button
                              key={sqIdx}
                              type="button"
                              onClick={() => handleSend(sq)}
                              className="text-[11px] font-medium text-brand-700 bg-white hover:bg-brand-50 border border-brand-200/70 px-2.5 py-1 rounded-full text-left transition flex items-center gap-1 shadow-2xs"
                            >
                              <span>{sq}</span>
                              <ChevronRight className="w-3 h-3 text-brand-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 w-fit text-slate-500 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                    <span>Checking hotel policies...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about check-in, pets, food..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white flex items-center justify-center transition flex-shrink-0 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}

          {/* TAB 2: Edge-Case Policy Simulator Mode */}
          {activeTab === "simulator" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {/* Presets Header */}
              <div>
                <p className="text-xs font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-brand-600" />
                  <span>Choose Test Travel Scenario:</span>
                </p>
                <p className="text-[11px] text-slate-500 mb-3">
                  Deterministic evaluation directly against SQLite & 12_hotel_policies.csv
                </p>

                {/* Preset Scenario Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      runSimulation("Late Arrival (2:30 AM)", {
                        arrival_time: "02:30",
                        has_pets: false,
                        children_ages: [],
                        adults_count: 2,
                      })
                    }
                    className={`p-2.5 rounded-2xl border text-left text-xs transition flex flex-col justify-between ${
                      activeScenarioLabel === "Late Arrival (2:30 AM)"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white hover:bg-slate-100 text-slate-800 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Late Arrival</span>
                    </div>
                    <span className="text-[10px] opacity-80">2:30 AM check-in</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      runSimulation("Traveling with Cat", {
                        arrival_time: null,
                        has_pets: true,
                        children_ages: [],
                        adults_count: 2,
                      })
                    }
                    className={`p-2.5 rounded-2xl border text-left text-xs transition flex flex-col justify-between ${
                      activeScenarioLabel === "Traveling with Cat"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white hover:bg-slate-100 text-slate-800 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <Dog className="w-3.5 h-3.5 text-emerald-400" />
                      <span>With Pet</span>
                    </div>
                    <span className="text-[10px] opacity-80">Traveling with cat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      runSimulation("Family with Toddler & 10yo", {
                        arrival_time: "14:00",
                        has_pets: false,
                        children_ages: [2, 10],
                        adults_count: 2,
                      })
                    }
                    className={`p-2.5 rounded-2xl border text-left text-xs transition flex flex-col justify-between ${
                      activeScenarioLabel === "Family with Toddler & 10yo"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white hover:bg-slate-100 text-slate-800 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Family & Kids</span>
                    </div>
                    <span className="text-[10px] opacity-80">Toddler (2) & 10yo</span>
                  </button>
                </div>
              </div>

              {simLoading && (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                  <span>Evaluating property constraints in real time...</span>
                </div>
              )}

              {/* Feasibility Table & Verdict Scorecard */}
              {!simLoading && simResult && (
                <div className="space-y-3 animate-fade-in">
                  {/* Overall Verdict Banner */}
                  <div
                    className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
                      simResult.overall_feasible
                        ? simResult.rules.some((r) => r.status === "WARNING")
                          ? "bg-amber-50/90 border-amber-300 text-amber-950"
                          : "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                        : "bg-rose-50/90 border-rose-300 text-rose-950"
                    }`}
                  >
                    {simResult.overall_feasible ? (
                      simResult.rules.some((r) => r.status === "WARNING") ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      )
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold uppercase tracking-wide">
                          {simResult.overall_feasible
                            ? simResult.rules.some((r) => r.status === "WARNING")
                              ? "Feasible with Notice"
                              : "100% Feasible"
                            : "Disqualified"}
                        </span>
                        <span className="text-[10px] opacity-75 font-mono">
                          ({activeScenarioLabel})
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 leading-relaxed font-medium">
                        {simResult.verdict_summary}
                      </p>
                    </div>
                  </div>

                  {/* Executive Feasibility Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>Feasibility Scorecard</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        12_hotel_policies.csv
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      {simResult.rules.map((rule, idx) => {
                        const isApproved = rule.status === "APPROVED";
                        const isWarning = rule.status === "WARNING";
                        const isDisqualified = rule.status === "DISQUALIFIED";

                        return (
                          <div key={idx} className="p-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                {isApproved && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                )}
                                {isWarning && (
                                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                )}
                                {isDisqualified && (
                                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                )}
                                <span>{rule.parameter}</span>
                              </div>

                              {/* Status Badge */}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                  isApproved
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isWarning
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {rule.status}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700 leading-relaxed pl-5.5">
                              {rule.hotel_rule}
                            </p>

                            {/* Exact Column Citation Monospace Pill */}
                            <div className="pl-5.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                              <span>Source:</span>
                              <code className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {rule.source_column}
                              </code>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
