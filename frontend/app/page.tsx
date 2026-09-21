import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { HotelCard } from "@/components/HotelCard";
import { api } from "@/lib/api";
import { Sparkles, Compass, ShieldCheck, Zap, HeartHandshake, ArrowRight } from "lucide-react";
import { HotelListItem } from "@/types";

export const revalidate = 0; // dynamic

export default async function HomePage() {
  // Fetch initial recommended hotels and top cities
  let recommendedHotels: HotelListItem[] = [];
  let cities: Array<{ city_id: string; name: string; state: string; hotel_count: number }> = [];

  try {
    const recRes = await api.getRecommendations("usr_001", undefined, 6);
    recommendedHotels = recRes.items || [];
  } catch {
    // fallback to popular hotels
    try {
      const fallback = await api.getHotels({ page_size: 6 });
      recommendedHotels = fallback.items || [];
    } catch {
      recommendedHotels = [];
    }
  }

  try {
    const cityRes = await api.getCities();
    cities = cityRes.cities.slice(0, 8);
  } catch {
    cities = [];
  }

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-[#F8FAFC]">
        {/* Glow ambient lights */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-tr from-brand-600/30 to-amber-500/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Tag Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-amber-300 text-xs font-bold mb-6 shadow-glow">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Indian Hospitality Engine</span>
          </div>

          {/* Heading */}
          <h1 className="font-heading font-black text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-[1.1] max-w-4xl mx-auto">
            Find Your Perfect Stay,{" "}
            <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-brand-300 bg-clip-text text-transparent">
              Matched to Your Vibe.
            </span>
          </h1>

          <p className="mt-5 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto font-normal">
            Discover verified heritage havelis, serene luxury retreats, and authentic boutique stays
            with natural language AI search and grounded concierge intelligence.
          </p>

          {/* Search Component */}
          <div className="mt-10 sm:mt-12">
            <SearchBar variant="hero" />
          </div>
        </div>
      </section>

      {/* Recommended for You Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-brand-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Personalised Intelligence</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
              Curated for Aarav’s Style
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Ranked with 90%+ Vibe Match based on your cultural travel preferences & interactions.
            </p>
          </div>
          <Link
            href="/search?sort_by=relevance"
            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 group self-start sm:self-auto"
          >
            <span>Explore all matches</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Hotel Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {recommendedHotels.map((hotel) => (
            <HotelCard key={hotel.hotel_id} hotel={hotel} />
          ))}
        </div>
      </section>

      {/* Iconic Indian Destinations */}
      {cities.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-brand-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Compass className="w-4 h-4 text-brand-600" />
              <span>Top Destinations</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
              Explore Across India
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {cities.map((c) => (
              <Link
                key={c.city_id}
                href={`/search?city=${encodeURIComponent(c.name)}`}
                className="group p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-brand-300 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900 group-hover:text-brand-600 transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">{c.state}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-brand-700">
                  <span>{c.hotel_count} properties</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Feature Highlights Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950 text-white shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-lg">Gemini Natural Language Search</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Type or speak queries naturally in Hindi, Tamil, or English. Gemini parses complex
                dietary needs, budgets, and vibe requirements instantly.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-lg">Grounded Property Concierge</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Get zero-hallucination answers to questions about pet policies, child extra beds, and
                check-in timing, backed by direct database citations.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-sky-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-lg">Transparent Indian GST</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Clear price breakdowns calculating exact 12% and 18% hospitality tax brackets with
                decimal precision. No hidden checkout surprises.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
