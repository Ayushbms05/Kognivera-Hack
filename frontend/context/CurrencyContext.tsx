"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import Decimal from "decimal.js";
import { CurrencyItem, PricingCalculateResponse } from "@/types";
import { api } from "@/lib/api";

interface CurrencyContextType {
  currency: string;
  setCurrency: (iso: string) => void;
  formatPrice: (amountInInr: number | string, maxFractionDigits?: number) => string;
  convertPrice: (amountInInr: number | string) => number;
  currentCurrencyItem: CurrencyItem;
  currencies: CurrencyItem[];
  loading: boolean;
  calculatePricing: (
    roomTypeId: string,
    ratePlanId?: string | null,
    nights?: number
  ) => Promise<PricingCalculateResponse | null>;
}

const DEFAULT_CURRENCIES: CurrencyItem[] = [
  {
    currency_id: "cur_inr",
    iso4217: "INR",
    code: "INR",
    name: "Indian Rupee",
    symbol: "₹",
    exchange_rate_to_inr: 1.0,
    rate_to_inr: 1.0,
    minor_unit_exponent: 2,
    display_locale: "en-IN",
  },
  {
    currency_id: "cur_usd",
    iso4217: "USD",
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    exchange_rate_to_inr: 83.333333,
    rate_to_inr: 0.012,
    minor_unit_exponent: 2,
    display_locale: "en-US",
  },
  {
    currency_id: "cur_eur",
    iso4217: "EUR",
    code: "EUR",
    name: "Euro",
    symbol: "€",
    exchange_rate_to_inr: 90.909091,
    rate_to_inr: 0.011,
    minor_unit_exponent: 2,
    display_locale: "de-DE",
  },
  {
    currency_id: "cur_gbp",
    iso4217: "GBP",
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    exchange_rate_to_inr: 105.263158,
    rate_to_inr: 0.0095,
    minor_unit_exponent: 2,
    display_locale: "en-GB",
  },
  {
    currency_id: "cur_jpy",
    iso4217: "JPY",
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
    exchange_rate_to_inr: 0.549451,
    rate_to_inr: 1.82,
    minor_unit_exponent: 0,
    display_locale: "ja-JP",
  },
  {
    currency_id: "cur_aed",
    iso4217: "AED",
    code: "AED",
    name: "UAE Dirham",
    symbol: "AED",
    exchange_rate_to_inr: 22.727273,
    rate_to_inr: 0.044,
    minor_unit_exponent: 2,
    display_locale: "ar-AE",
  },
  {
    currency_id: "cur_sgd",
    iso4217: "SGD",
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    exchange_rate_to_inr: 62.5,
    rate_to_inr: 0.016,
    minor_unit_exponent: 2,
    display_locale: "en-SG",
  },
  {
    currency_id: "cur_kwd",
    iso4217: "KWD",
    code: "KWD",
    name: "Kuwaiti Dinar",
    symbol: "KD",
    exchange_rate_to_inr: 271.5,
    rate_to_inr: 0.003683,
    minor_unit_exponent: 3,
    display_locale: "ar-KW",
  },
];

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "INR",
  setCurrency: () => {},
  formatPrice: (amt) => `₹${amt}`,
  convertPrice: (amt) => Number(amt),
  currentCurrencyItem: DEFAULT_CURRENCIES[0],
  currencies: DEFAULT_CURRENCIES,
  loading: false,
  calculatePricing: async () => null,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>("INR");
  const [currencies, setCurrencies] = useState<CurrencyItem[]>(DEFAULT_CURRENCIES);
  const [loading, setLoading] = useState(true);

  // Load currencies from backend and restore saved preference
  useEffect(() => {
    async function loadCurrencies() {
      try {
        const saved = typeof window !== "undefined" ? localStorage.getItem("sf_currency") : null;
        if (saved) setCurrencyState(saved);

        const res = await api.getCurrencies();
        if (res && res.currencies && res.currencies.length > 0) {
          const symbolMap: Record<string, string> = {
            INR: "₹",
            USD: "$",
            EUR: "€",
            GBP: "£",
            AED: "AED",
            SGD: "S$",
            AUD: "A$",
            CAD: "C$",
            JPY: "¥",
            CHF: "CHF",
            THB: "฿",
            KWD: "KD",
            BHD: "BD",
            OMR: "OMR",
            QAR: "QR",
            SAR: "SR",
          };

          const merged = res.currencies.map((c) => ({
            ...c,
            symbol: symbolMap[c.iso4217] || c.symbol || c.iso4217,
            minor_unit_exponent: c.minor_unit_exponent !== undefined ? c.minor_unit_exponent : 2,
            exchange_rate_to_inr: c.exchange_rate_to_inr || (c.rate_to_inr ? 1 / c.rate_to_inr : 1.0),
          }));

          setCurrencies(merged);
        }
      } catch (err) {
        console.warn("Using fallback currency list:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCurrencies();
  }, []);

  const setCurrency = (iso: string) => {
    setCurrencyState(iso);
    if (typeof window !== "undefined") {
      localStorage.setItem("sf_currency", iso);
    }
  };

  const currentCurrencyItem =
    currencies.find((c) => c.iso4217.toUpperCase() === currency.toUpperCase()) ||
    DEFAULT_CURRENCIES[0];

  // Exact Fractional Conversion using Decimal.js:
  // Target Currency Amount = (Amount in INR) / (exchange_rate_to_inr)
  // Round strictly to minor_unit_exponent
  const convertPrice = useCallback(
    (amountInInr: number | string): number => {
      try {
        const base = new Decimal(amountInInr || 0);
        const exchangeRate = new Decimal(
          currentCurrencyItem.exchange_rate_to_inr ||
            (currentCurrencyItem.rate_to_inr ? 1 / currentCurrencyItem.rate_to_inr : 1.0)
        );
        const converted = base.dividedBy(exchangeRate);
        const exponent =
          currentCurrencyItem.minor_unit_exponent !== undefined
            ? currentCurrencyItem.minor_unit_exponent
            : 2;
        return converted.toDecimalPlaces(exponent, Decimal.ROUND_HALF_UP).toNumber();
      } catch {
        return Number(amountInInr || 0);
      }
    },
    [currentCurrencyItem]
  );

  const formatPrice = useCallback(
    (amountInInr: number | string, maxFractionDigits?: number): string => {
      try {
        const base = new Decimal(amountInInr || 0);
        const exchangeRate = new Decimal(
          currentCurrencyItem.exchange_rate_to_inr ||
            (currentCurrencyItem.rate_to_inr ? 1 / currentCurrencyItem.rate_to_inr : 1.0)
        );
        const converted = base.dividedBy(exchangeRate);
        const exponent =
          currentCurrencyItem.minor_unit_exponent !== undefined
            ? currentCurrencyItem.minor_unit_exponent
            : 2;

        const digits = maxFractionDigits !== undefined ? maxFractionDigits : exponent;
        const rounded = converted.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP).toNumber();

        try {
          return new Intl.NumberFormat(currentCurrencyItem.display_locale || "en-US", {
            style: "currency",
            currency: currentCurrencyItem.iso4217,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          }).format(rounded);
        } catch {
          return `${currentCurrencyItem.symbol}${rounded.toLocaleString(undefined, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          })}`;
        }
      } catch {
        return `${currentCurrencyItem.symbol} ${amountInInr}`;
      }
    },
    [currentCurrencyItem]
  );

  // Real-time Pricing API integration
  const calculatePricing = useCallback(
    async (
      roomTypeId: string,
      ratePlanId?: string | null,
      nights: number = 1
    ): Promise<PricingCalculateResponse | null> => {
      try {
        const res = await api.calculatePricing({
          room_type_id: roomTypeId,
          rate_plan_id: ratePlanId,
          target_currency: currentCurrencyItem.iso4217,
          nights,
        });
        return res;
      } catch (err) {
        console.error("Failed to calculate pricing breakdown:", err);
        return null;
      }
    },
    [currentCurrencyItem.iso4217]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatPrice,
        convertPrice,
        currentCurrencyItem,
        currencies,
        loading,
        calculatePricing,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
