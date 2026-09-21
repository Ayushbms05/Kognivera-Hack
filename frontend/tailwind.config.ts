import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Terracotta (Boutique luxury primary accent)
        terracotta: {
          50: "#FDF6F4",
          100: "#FCEAE5",
          200: "#F9D6CC",
          300: "#F3B5A3",
          400: "#EA886D",
          500: "#E05C3A", // Signature Accent
          600: "#CC4421",
          700: "#AA3416",
          800: "#8C2C16",
          900: "#742816",
          950: "#3F1106",
        },
        // Forest Green (Organic heritage & nature)
        forest: {
          50: "#F2FBF5",
          100: "#E2F6E8",
          200: "#C4ECD1",
          300: "#95DDAE",
          400: "#5EC484",
          500: "#36A862",
          600: "#27884D",
          700: "#206D3E",
          800: "#1D5634",
          900: "#18472C",
        },
        // Warm Sand & Linen
        sand: {
          50: "#FAF9F6",
          100: "#F4F1EA",
          200: "#EBE5D8",
          300: "#DFD4C0",
          400: "#CFC0A4",
          500: "#BFAB8B",
        },
        // Luxury Deep Brand Indigos
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#1E1B4B",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "Outfit", "Plus Jakarta Sans", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.02), 0 1px 2px -1px rgba(0, 0, 0, 0.02)",
        soft: "0 10px 30px -5px rgba(15, 23, 42, 0.04), 0 4px 10px -2px rgba(15, 23, 42, 0.02)",
        float: "0 25px 50px -12px rgba(15, 23, 42, 0.09)",
        "terracotta-glow": "0 0 25px -4px rgba(224, 92, 58, 0.35)",
        glass: "0 8px 32px 0 rgba(15, 23, 42, 0.05)",
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3.5xl": "1.75rem",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 2s infinite linear",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
