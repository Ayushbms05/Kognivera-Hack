"""
Pure Mathematical Yield Arbitrage Engine for StayFinder.
Calculates deterministic inventory fill rate, cancellation probability heuristic,
perishable time decay, and discount-to-probability elasticity without LLM tokens.
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime, date
from typing import Dict, Any, Optional, List
import aiosqlite

from core.config import get_settings


class YieldArbitrageEngine:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or get_settings().db_abs_path

    async def ensure_tables(self, db: aiosqlite.Connection) -> None:
        """Create sf_limit_orders table in SQLite."""
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sf_limit_orders (
                order_id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL,
                room_type_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                for_date TEXT NOT NULL,
                base_rate REAL NOT NULL,
                target_price REAL NOT NULL,
                discount_pct REAL NOT NULL,
                fill_probability REAL NOT NULL,
                upi_mandate_id TEXT NOT NULL,
                upi_mandate_uri TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        await db.commit()

    def parse_time_decay(self, for_date_str: str) -> tuple[int, float]:
        """
        Calculate days until check-in and the corresponding perishable urgency decay factor.
        Perishable room inventory spoils if unsold; urgency rises as date approaches.
        """
        try:
            target_dt = datetime.strptime(for_date_str, "%Y-%m-%d").date()
            # Reference date anchored around demo dataset horizon (or current date)
            # Default dataset dates are Sept/Oct 2026; if target is in 2026, use Sept 2026 baseline
            today = date.today()
            if target_dt.year == 2026 and today.year != 2026:
                anchor = date(2026, 9, 21)
            else:
                anchor = today

            delta_days = (target_dt - anchor).days
            days_until = max(1, delta_days)
        except Exception:
            days_until = 3

        if days_until <= 2:
            decay_factor = 0.95
        elif days_until <= 7:
            decay_factor = 0.85
        elif days_until <= 14:
            decay_factor = 0.65
        else:
            decay_factor = 0.45

        return days_until, decay_factor

    async def get_cancellation_heuristic(
        self, db: aiosqlite.Connection, hotel_id: str, room_type_id: str
    ) -> tuple[str, float, float]:
        """
        Read cancellation policy or rate plan rules.
        Deterministic heuristic:
        - Flexible (window >= 24h, penalty <= 25%): 15% cancellation rate prob
        - Moderate: 8% cancellation rate prob
        - Strict / Non-Refundable: 2% cancellation rate prob
        Returns: (policy_name, cancellation_prob, weight_multiplier)
        """
        # Check rate plan cancellation terms first
        cursor = await db.execute("""
            SELECT cancellation_window_hours, cancellation_penalty_pct, plan_type
            FROM hotel_rate_plans
            WHERE room_type_id = ?
            LIMIT 1
        """, [room_type_id])
        rp = await cursor.fetchone()

        if rp:
            window = rp["cancellation_window_hours"] or 0
            penalty = rp["cancellation_penalty_pct"] if rp["cancellation_penalty_pct"] is not None else 100
            plan_type = (rp["plan_type"] or "").lower()

            if "non_ref" in plan_type or penalty >= 90 or window == 0:
                return "Strict (Non-Refundable)", 0.02, 1.0
            elif window >= 48 and penalty <= 25:
                return "Flexible (48h)", 0.18, 1.65
            elif window >= 24 and penalty <= 50:
                return "Flexible (24h)", 0.15, 1.5
            else:
                return "Moderate (24h-48h)", 0.08, 1.25

        # Check hotel policies text
        p_cursor = await db.execute("""
            SELECT child_policy, pet_policy, early_checkin_possible
            FROM hotel_policies
            WHERE hotel_id = ?
        """, [hotel_id])
        pol = await p_cursor.fetchone()
        if pol and pol["early_checkin_possible"]:
            return "Flexible Hospitality Policy", 0.15, 1.5

        return "Moderate Policy", 0.08, 1.25

    async def calculate_arbitrage_metrics(
        self,
        hotel_id: str,
        room_type_id: str,
        for_date_str: str,
        db: aiosqlite.Connection,
    ) -> Dict[str, Any]:
        """
        Compute deterministic inventory metrics, fill rate, and base price drop probability.
        """
        await self.ensure_tables(db)

        # 1. Fetch Room Base Rate & Default Capacity
        rt_cur = await db.execute("""
            SELECT name, base_rate, currency, total_units
            FROM hotel_room_types
            WHERE room_type_id = ?
        """, [room_type_id])
        rt_row = await rt_cur.fetchone()
        if not rt_row:
            # Fallback to any room in hotel
            alt_cur = await db.execute("""
                SELECT room_type_id, name, base_rate, currency, total_units
                FROM hotel_room_types
                WHERE hotel_id = ?
                LIMIT 1
            """, [hotel_id])
            rt_row = await alt_cur.fetchone()
            if not rt_row:
                raise ValueError(f"Hotel {hotel_id} has no configured room types")
            room_type_id = rt_row["room_type_id"]

        room_name = rt_row["name"]
        base_rate = float(rt_row["base_rate"])
        currency = rt_row["currency"] or "INR"
        def_total = int(rt_row["total_units"] or 10)

        # 2. Fetch inventory calendar for the given date
        inv_cur = await db.execute("""
            SELECT total_units, booked_units, held_units, price
            FROM inventory_calendar
            WHERE entity_id = ? AND for_date = ?
        """, [room_type_id, for_date_str])
        inv_row = await inv_cur.fetchone()

        if inv_row:
            total_units = int(inv_row["total_units"] or def_total)
            booked_units = int(inv_row["booked_units"] or 0)
            held_units = int(inv_row["held_units"] or 0)
            live_price = float(inv_row["price"] or base_rate)
        else:
            # Synthetic default inventory for dates without calendar row
            total_units = def_total
            booked_units = max(1, int(def_total * 0.35))
            held_units = 1
            live_price = base_rate

        unsold_units = max(0, total_units - booked_units - held_units)
        fill_rate = round((booked_units + held_units) / max(1, total_units), 3)
        unsold_ratio = round(unsold_units / max(1, total_units), 4)

        # 3. Time Decay & Cancellation Heuristic
        days_until, time_decay = self.parse_time_decay(for_date_str)
        policy_name, cancel_prob, cancel_weight = await self.get_cancellation_heuristic(
            db, hotel_id, room_type_id
        )

        # 4. Base Price Drop Probability
        # Formula: (Unsold Units / Total Units) * Cancellation Probability Weight * Time Decay
        # Hotels with high unsold inventory (>50%) and flexible cancellations near check-in have high drop probability.
        raw_prob = unsold_ratio * cancel_weight * time_decay
        base_drop_prob = min(0.95, max(0.18, raw_prob))

        # 5. Precompute Probability Curve for Discounts (5% to 30%)
        probability_curve: List[Dict[str, Any]] = []
        for disc_pct in [5, 10, 15, 20, 25, 30]:
            disc_factor = disc_pct / 100.0
            # Higher discount requested reduces fill probability: P(fill) = P(drop) * (1 - 0.75 * d)
            prob = base_drop_prob * (1.0 - 0.75 * disc_factor)
            prob_clamped = round(max(0.10, min(0.95, prob)), 3)
            limit_price = round(live_price * (1.0 - disc_factor), 2)
            probability_curve.append({
                "discount_pct": disc_pct,
                "target_price": limit_price,
                "fill_probability": prob_clamped,
                "fill_probability_pct": int(round(prob_clamped * 100)),
                "is_eligible": prob_clamped > 0.50,
            })

        # Recommended limit order price (sweet spot around ~15% discount or highest with >60% prob)
        rec = next((p for p in probability_curve if p["fill_probability"] >= 0.65), probability_curve[1])

        return {
            "hotel_id": hotel_id,
            "room_type_id": room_type_id,
            "room_name": room_name,
            "for_date": for_date_str,
            "base_rate": live_price,
            "currency": currency,
            "total_units": total_units,
            "booked_units": booked_units,
            "held_units": held_units,
            "unsold_units": unsold_units,
            "fill_rate": fill_rate,
            "days_until_checkin": days_until,
            "time_decay_factor": time_decay,
            "cancellation_policy": policy_name,
            "cancellation_rate_prob": cancel_prob,
            "base_drop_probability": round(base_drop_prob, 3),
            "base_drop_probability_pct": int(round(base_drop_prob * 100)),
            "recommended_target_price": rec["target_price"],
            "recommended_discount_pct": rec["discount_pct"],
            "recommended_fill_probability": rec["fill_probability"],
            "probability_curve": probability_curve,
        }

    async def place_arbitrage_order(
        self,
        hotel_id: str,
        room_type_id: str,
        user_id: str,
        for_date_str: str,
        target_price: float,
        db: aiosqlite.Connection,
    ) -> Dict[str, Any]:
        """
        Validate limit order target price against probability threshold (> 50%).
        If qualified, persist to sf_limit_orders with simulated NPCI UPI AutoPay mandate.
        """
        metrics = await self.calculate_arbitrage_metrics(hotel_id, room_type_id, for_date_str, db)
        base_rate = float(metrics["base_rate"])
        
        # Calculate requested discount percentage
        if target_price >= base_rate:
            discount_pct = 0.0
            fill_prob = metrics["base_drop_probability"]
        else:
            discount_pct = round(((base_rate - target_price) / base_rate) * 100, 1)
            disc_factor = discount_pct / 100.0
            prob = metrics["base_drop_probability"] * (1.0 - 0.75 * disc_factor)
            fill_prob = round(max(0.05, min(0.95, prob)), 3)

        fill_prob_pct = int(round(fill_prob * 100))

        # Check threshold
        if fill_prob <= 0.50:
            return {
                "success": False,
                "eligible": False,
                "fill_probability": fill_prob,
                "fill_probability_pct": fill_prob_pct,
                "target_price": target_price,
                "base_rate": base_rate,
                "discount_pct": discount_pct,
                "message": f"Limit order rejected: Probability of filling ({fill_prob_pct}%) is below the 50% arbitrage threshold. Increase your target price closer to market rate ({base_rate:.2f}).",
            }

        # Generate unique order and mandate IDs
        order_id = f"ord_{uuid.uuid4().hex[:8]}"
        mandate_id = f"upi_man_{uuid.uuid4().hex[:10]}"
        now = datetime.now().isoformat()

        # Generate official NPCI conformant UPI AutoPay mandate URI
        # Standard: upi://mandate?pa=...&pn=...&am=...&max_am=...&cu=INR&validity=...
        upi_mandate_uri = (
            f"upi://mandate?pa=stayfinder.escrow@icici"
            f"&pn=StayFinder%20Hotels%20Escrow"
            f"&am={target_price:.2f}"
            f"&max_am={base_rate:.2f}"
            f"&cu={metrics['currency']}"
            f"&validity={for_date_str}"
            f"&tn=ArbitrageLimitOrder_{order_id}"
        )

        # Persist order to SQLite table sf_limit_orders
        await db.execute("""
            INSERT INTO sf_limit_orders (
                order_id, hotel_id, room_type_id, user_id, for_date,
                base_rate, target_price, discount_pct, fill_probability,
                upi_mandate_id, upi_mandate_uri, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
        """, (
            order_id,
            hotel_id,
            room_type_id,
            user_id,
            for_date_str,
            base_rate,
            target_price,
            discount_pct,
            fill_prob,
            mandate_id,
            upi_mandate_uri,
            now,
        ))
        await db.commit()

        return {
            "success": True,
            "eligible": True,
            "order_id": order_id,
            "status": "ACTIVE",
            "hotel_id": hotel_id,
            "room_type_id": room_type_id,
            "room_name": metrics["room_name"],
            "for_date": for_date_str,
            "base_rate": base_rate,
            "target_price": target_price,
            "discount_pct": discount_pct,
            "fill_probability": fill_prob,
            "fill_probability_pct": fill_prob_pct,
            "upi_mandate_id": mandate_id,
            "upi_mandate_uri": upi_mandate_uri,
            "created_at": now,
            "message": f"Limit order successfully active! Probability of filling: {fill_prob_pct}%. We will automatically execute a UPI mandate if the hotel drops the rate to your limit price.",
        }


# Singleton engine instance
arbitrage_engine = YieldArbitrageEngine()
