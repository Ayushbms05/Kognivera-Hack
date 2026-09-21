"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Heart,
  X,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  MapPin,
  Flame,
  Check,
  RotateCcw,
} from "lucide-react";
import confetti from "canvas-confetti";
import { api } from "@/lib/api";
import { OnboardingImageItem, SwipedImagePayload, PreferencesSubmissionResponse } from "@/types";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onCompleted?: (result: PreferencesSubmissionResponse) => void;
}

export function OnboardingModal({ isOpen, onClose, userId = "usr_guest", onCompleted }: OnboardingModalProps) {
  const router = useRouter();
  const [images, setImages] = useState<OnboardingImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedImages, setLikedImages] = useState<SwipedImagePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PreferencesSubmissionResponse | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen]);

  async function loadImages() {
    setLoading(true);
    setResult(null);
    setCurrentIndex(0);
    setLikedImages([]);
    try {
      const res = await api.getOnboardingImages();
      setImages(res.items || []);
    } catch (err) {
      console.error("Failed to load onboarding images:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwipe(liked: boolean) {
    if (currentIndex >= images.length) return;
    const currentImg = images[currentIndex];

    setSwipeDirection(liked ? "right" : "left");

    let updatedLiked = likedImages;
    if (liked) {
      const payload: SwipedImagePayload = {
        media_id: currentImg.media_id,
        hotel_id: currentImg.hotel_id,
        alt_text: currentImg.alt_text,
        caption: currentImg.caption,
        property_type: currentImg.property_type,
      };
      updatedLiked = [...likedImages, payload];
      setLikedImages(updatedLiked);
    }

    setTimeout(async () => {
      setSwipeDirection(null);
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);

      if (nextIndex >= images.length) {
        // Complete swipe session and calibrate
        await finalizePreferences(updatedLiked);
      }
    }, 250);
  }

  async function finalizePreferences(likes: SwipedImagePayload[]) {
    setSubmitting(true);
    try {
      // Use active user from localStorage or fallback
      const activeUid = localStorage.getItem("sf_active_user_id") || userId;
      const res = await api.submitPreferences({
        user_id: activeUid,
        liked_images: likes,
        total_swiped: images.length,
      });
      setResult(res);

      // Save to localStorage for instant personalized experience
      localStorage.setItem("sf_active_user_vibe", res.top_vibe);
      localStorage.setItem("sf_active_user_id", res.user_id);
      window.dispatchEvent(new Event("sf_user_updated"));

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#E05C3A", "#D97706", "#10B981", "#3B82F6"],
      });

      if (onCompleted) {
        onCompleted(res);
      }
    } catch (err) {
      console.error("Failed to submit preferences:", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const currentImg = images[currentIndex];
  const progressPct = images.length > 0 ? Math.round((currentIndex / images.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3.5xl bg-white border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-white shadow-sm">
              <Compass className="w-4 h-4 animate-pulse_slow" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading font-extrabold text-base text-slate-900">
                  Calibrate Your Travel DNA
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Zero Tokens
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Swipe right to like, left to pass. We build your personalized affinity vector.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        {!result && !loading && (
          <div className="w-full bg-slate-100 h-1.5">
            <div
              className="bg-gradient-to-r from-brand-500 to-amber-500 h-1.5 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col justify-center">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Loading Curated Visual Stays...</p>
              <p className="text-xs text-slate-400">Fetching real hero scenes from 16_hotel_media.csv</p>
            </div>
          ) : submitting ? (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-amber-500 animate-pulse mx-auto" />
              <p className="text-sm font-bold text-slate-900">Calibrating Travel Affinity Vector...</p>
              <p className="text-xs text-slate-500">
                Executing local keyword-matching algorithm over metadata tokens
              </p>
            </div>
          ) : result ? (
            /* Result Screen */
            <div className="text-center space-y-5 py-4 animate-scale-up">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>DNA Vector Calibrated</span>
              </div>

              <div>
                <h4 className="font-heading font-black text-2xl text-slate-900">
                  {result.top_vibe}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {result.message}
                </p>
              </div>

              {/* DNA Category Breakdown Bars */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-left space-y-2.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Affinity Vector Distribution
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {Object.entries(result.affinity_vector)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([cat, val]) => (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                          <span className="capitalize">{cat}</span>
                          <span className="text-slate-500 font-mono">
                            {Math.round(val * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-brand-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.round(val * 100 * 2))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Matched Keywords Pill Box */}
              {result.matched_keywords && Object.keys(result.matched_keywords).length > 0 && (
                <div className="text-left space-y-1.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Extracted Semantic Tokens
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.matched_keywords)
                      .flatMap(([, kws]) => kws)
                      .slice(0, 8)
                      .map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium"
                        >
                          #{kw}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={loadImages}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake Swipe</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push("/search?personalization=true");
                  }}
                  className="flex-1 py-3 rounded-2xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-heading font-bold shadow-md transition flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
                >
                  <span>Explore Ranked Stays</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : currentImg ? (
            /* Active Swipe Card */
            <div className="space-y-4">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-md border border-slate-200/80 bg-slate-900 group">
                <img
                  src={currentImg.image_url}
                  alt={currentImg.alt_text}
                  className={`w-full h-full object-cover transition-transform duration-300 ${
                    swipeDirection === "right"
                      ? "translate-x-16 rotate-6 opacity-60"
                      : swipeDirection === "left"
                      ? "-translate-x-16 -rotate-6 opacity-60"
                      : "group-hover:scale-105"
                  }`}
                />

                {/* Vibe Hint Badge */}
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1 border border-white/15">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{currentImg.vibe_hint}</span>
                </div>

                {/* Counter Pill */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-md text-white text-[10px] font-mono font-bold border border-white/15">
                  {currentIndex + 1} / {images.length}
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent text-white space-y-1">
                  <h4 className="font-heading font-extrabold text-base leading-tight">
                    {currentImg.hotel_name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3 text-terracotta-400" />
                      {currentImg.city_name}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{currentImg.property_type}</span>
                    <span>•</span>
                    <span>{currentImg.star_rating}★</span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-1 italic">
                    "{currentImg.alt_text}"
                  </p>
                </div>
              </div>

              {/* Swipe Action Buttons */}
              <div className="flex items-center justify-center gap-6 pt-2">
                <button
                  type="button"
                  onClick={() => handleSwipe(false)}
                  className="w-14 h-14 rounded-full bg-white border-2 border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-400 hover:bg-rose-50/50 shadow-md transition-all flex items-center justify-center hover:scale-110 active:scale-95 group"
                  title="Pass"
                >
                  <X className="w-6 h-6 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSwipe(true)}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-600 to-amber-500 text-white shadow-terracotta-glow hover:shadow-lg transition-all flex items-center justify-center hover:scale-110 active:scale-95 group"
                  title="Like / Add to Travel DNA"
                >
                  <Heart className="w-7 h-7 fill-white stroke-none group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm">
              All images viewed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
