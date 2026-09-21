"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { GroupSplitResponse } from "@/types";
import {
  Users,
  Plus,
  Minus,
  Share2,
  Copy,
  Check,
  QrCode,
  Sparkles,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

interface GroupSplitCardProps {
  bookingId: string;
  totalAmount: number;
  currency: string;
}

export default function GroupSplitCard({
  bookingId,
  totalAmount,
  currency,
}: GroupSplitCardProps) {
  const { formatPrice } = useCurrency();
  const [partySize, setPartySize] = useState<number>(3);
  const [splitData, setSplitData] = useState<GroupSplitResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchSplit() {
      setLoading(true);
      try {
        const res = await api.splitBooking(bookingId, partySize);
        if (isMounted) {
          setSplitData(res);
        }
      } catch (err) {
        console.error("Error calculating group split:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchSplit();

    return () => {
      isMounted = false;
    };
  }, [bookingId, partySize]);

  const handleCopyUPI = () => {
    if (!splitData?.upi_uri) return;
    navigator.clipboard.writeText(splitData.upi_uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!splitData?.whatsapp_share_url) return;
    window.open(splitData.whatsapp_share_url, "_blank");
  };

  const perPersonShare = splitData ? splitData.per_person_share : totalAmount / partySize;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden mt-8 transition-all hover:shadow-md">
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-black text-lg text-white">
                Split with Travelers
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold tracking-wide uppercase border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Zero-Drift
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Deterministic NPCI UPI payment settlement &amp; Largest Remainder apportionment
            </p>
          </div>
        </div>

        {/* Party Size Stepper */}
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/10">
          <span className="text-xs font-semibold px-2 text-slate-300">Guests:</span>
          <button
            type="button"
            onClick={() => setPartySize((p) => Math.max(2, p - 1))}
            disabled={partySize <= 2}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white"
            aria-label="Decrease party size"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-7 text-center font-heading font-black text-base text-white">
            {partySize}
          </span>
          <button
            type="button"
            onClick={() => setPartySize((p) => Math.min(6, p + 1))}
            disabled={partySize >= 6}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white"
            aria-label="Increase party size"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Stepper Pills (2 to 6) */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs text-slate-600">
        <span className="font-semibold text-slate-400 whitespace-nowrap">Quick select:</span>
        {[2, 3, 4, 5, 6].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => setPartySize(num)}
            className={`px-3 py-1 rounded-xl font-bold transition ${
              partySize === num
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200"
            }`}
          >
            {num} Guests
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1 hidden sm:flex">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Statutory NPCI Escrow Spec
        </span>
      </div>

      {/* Main Split Content */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left Column: Share computation & Breakdown */}
        <div className="md:col-span-7 space-y-5">
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-baseline justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-900 tracking-wide uppercase">
                Per-Person Share ({partySize} Travelers)
              </p>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                Exact individual amount to collect via UPI
              </p>
            </div>
            <div className="text-right">
              <span className="font-heading font-black text-3xl text-indigo-950">
                {formatPrice(perPersonShare)}
              </span>
              <p className="text-[10px] font-bold text-indigo-600/90 mt-0.5">
                Total: {formatPrice(totalAmount)}
              </p>
            </div>
          </div>

          {/* Traveler Breakdown List */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Apportionment Breakdown:</span>
              <span className="text-[10px] font-normal text-slate-400">
                (Cent-accurate Hamilton Distribution)
              </span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(splitData?.shares || Array(partySize).fill(perPersonShare)).map((share, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-slate-600 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    {idx === 0 ? "You (Organizer)" : `Traveler ${idx + 1}`}
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatPrice(share)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={!splitData?.whatsapp_share_url}
              className="flex-1 px-5 py-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 active:scale-98"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Payment Link on WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyUPI}
              disabled={!splitData?.upi_uri}
              className="px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 active:scale-98"
              title="Copy UPI Deep Link URI"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copy UPI URI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Interactive NPCI UPI QR Code */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-center">
          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 inline-block relative group">
            {splitData?.upi_uri ? (
              <QRCodeSVG
                value={splitData.upi_uri}
                size={160}
                level="M"
                includeMargin={false}
                className="rounded-lg"
              />
            ) : (
              <div className="w-40 h-40 bg-slate-100 rounded-lg flex items-center justify-center">
                <QrCode className="w-10 h-10 text-slate-300 animate-pulse" />
              </div>
            )}
            <div className="absolute inset-0 bg-indigo-900/5 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition rounded-2xl flex items-center justify-center pointer-events-none">
              <span className="bg-white/95 text-slate-800 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm border border-slate-200">
                Scan with any UPI App
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-800">
              <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
              <span>GPay • PhonePe • Paytm • BHIM</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              VPA: stayfinder.escrow@icici
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
