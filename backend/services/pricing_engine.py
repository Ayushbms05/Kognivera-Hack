"""
Deterministic Financial Engine with Strict Decimal Math,
Statutory Indian Hospitality GST Compliance, and Largest-Remainder Apportionment.
Zero LLM calls - 100% deterministic fractional math.
"""

from decimal import Decimal, ROUND_HALF_UP
import math
import sqlite3
from typing import Dict, Any, Optional
from core.config import get_settings


def format_currency_string(amount: Decimal, symbol: str, exponent: int, locale_code: str = "en-IN") -> str:
    """Format decimal amount with proper exponent and symbol."""
    if exponent == 0:
        val_str = f"{int(amount):,}"
    else:
        val_str = f"{amount:,.{exponent}f}"
    
    # Handle negative values gracefully
    if amount < 0:
        return f"-{symbol}{val_str.lstrip('-')}"
    return f"{symbol}{val_str}"


def calculate_pricing_breakdown(
    room_type_id: str,
    rate_plan_id: Optional[str] = None,
    target_currency: str = "INR",
    nights: int = 1,
) -> Dict[str, Any]:
    """
    Computes exact room rate, rate plan delta, statutory Indian GST,
    and multi-currency conversion with largest-remainder apportionment.
    Guarantees: Subtotal + RatePlanDelta + GST == Total (no 1-cent/1-paisa drift).
    """
    if nights < 1:
        nights = 1

    clean_room_id = room_type_id.strip().rstrip("./")
    target_curr = target_currency.strip().upper()

    conn = sqlite3.connect(get_settings().db_abs_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Fetch Room Type
    cursor.execute(
        "SELECT room_type_id, hotel_id, name, base_rate, currency FROM hotel_room_types WHERE room_type_id = ?",
        [clean_room_id],
    )
    room = cursor.fetchone()
    if not room:
        conn.close()
        raise ValueError(f"Room type '{clean_room_id}' not found")

    room_name = room["name"]
    base_rate_inr = Decimal(str(room["base_rate"]))

    # 2. Fetch Rate Plan (if provided)
    rate_plan_name: Optional[str] = None
    price_delta_inr = Decimal("0.00")
    if rate_plan_id:
        clean_plan_id = rate_plan_id.strip().rstrip("./")
        cursor.execute(
            "SELECT rate_plan_id, name, price_delta, currency FROM hotel_rate_plans WHERE rate_plan_id = ?",
            [clean_plan_id],
        )
        plan = cursor.fetchone()
        if plan:
            rate_plan_name = plan["name"]
            price_delta_inr = Decimal(str(plan["price_delta"]))

    # 3. Fetch Currency Info
    cursor.execute(
        "SELECT currency_id, iso4217, name, symbol, minor_unit_exponent, display_locale, exchange_rate_to_inr FROM currencies WHERE iso4217 = ?",
        [target_curr],
    )
    curr_row = cursor.fetchone()
    conn.close()

    if not curr_row:
        # Fallback to INR
        target_curr = "INR"
        currency_symbol = "₹"
        minor_exponent = 2
        display_locale = "en-IN"
        exchange_rate_to_inr = Decimal("1.0")
    else:
        currency_symbol = curr_row["symbol"] or target_curr
        minor_exponent = int(curr_row["minor_unit_exponent"] if curr_row["minor_unit_exponent"] is not None else 2)
        display_locale = curr_row["display_locale"] or "en-IN"
        exchange_rate_to_inr = Decimal(str(curr_row["exchange_rate_to_inr"] or 1.0))

    # 4. Indian Statutory GST Slab Calculation
    # Effective nightly rate = nightly base_rate + nightly price_delta
    effective_nightly_rate_inr = base_rate_inr + price_delta_inr
    if effective_nightly_rate_inr <= Decimal("7500.00"):
        gst_slab_pct = 12
    else:
        gst_slab_pct = 18
    gst_rate = Decimal(gst_slab_pct) / Decimal("100")

    # 5. Amounts in INR for 'nights'
    nights_d = Decimal(str(nights))
    subtotal_inr = base_rate_inr * nights_d
    delta_inr = price_delta_inr * nights_d
    taxable_inr = subtotal_inr + delta_inr
    gst_inr = taxable_inr * gst_rate
    total_inr = taxable_inr + gst_inr

    # 6. Multi-Currency Conversion & Largest-Remainder Apportionment
    # Target Currency Amount = (Amount in INR) / (exchange_rate_to_inr)
    quantum = Decimal("1") if minor_exponent == 0 else Decimal("10") ** -minor_exponent

    u_subtotal = subtotal_inr / exchange_rate_to_inr
    u_delta = delta_inr / exchange_rate_to_inr
    u_gst = gst_inr / exchange_rate_to_inr
    u_total = total_inr / exchange_rate_to_inr

    # Total rounded with ROUND_HALF_UP
    target_total = u_total.quantize(quantum, rounding=ROUND_HALF_UP)
    target_units = int(target_total / quantum)

    # Decompose into integer quanta and fractional remainder
    components = [
        {"id": "subtotal", "val": u_subtotal},
        {"id": "rate_plan_delta", "val": u_delta},
        {"id": "tax_gst", "val": u_gst},
    ]

    for c in components:
        units_float = c["val"] / quantum
        floor_units = int(math.floor(units_float))
        c["floor_units"] = floor_units
        c["remainder"] = units_float - Decimal(floor_units)

    sum_floors = sum(c["floor_units"] for c in components)
    discrepancy = target_units - sum_floors

    # Sort descending by remainder (largest remainder first)
    components_sorted = sorted(components, key=lambda x: x["remainder"], reverse=True)
    
    quantized_results: Dict[str, Decimal] = {}
    for i, c in enumerate(components_sorted):
        extra = 1 if i < discrepancy else 0
        final_units = c["floor_units"] + extra
        quantized_results[c["id"]] = (Decimal(final_units) * quantum).quantize(quantum)

    final_subtotal = quantized_results["subtotal"]
    final_delta = quantized_results["rate_plan_delta"]
    final_gst = quantized_results["tax_gst"]

    # Strict invariant check
    assert final_subtotal + final_delta + final_gst == target_total, "Apportionment invariant violation!"

    # 7. Formatted outputs
    return {
        "room_type_id": clean_room_id,
        "rate_plan_id": rate_plan_id,
        "room_name": room_name,
        "rate_plan_name": rate_plan_name,
        "target_currency": target_curr,
        "currency_symbol": currency_symbol,
        "minor_unit_exponent": minor_exponent,
        "display_locale": display_locale,
        "exchange_rate_to_inr": str(exchange_rate_to_inr),
        "nights": nights,
        "effective_nightly_rate_inr": f"{effective_nightly_rate_inr:.2f}",
        "gst_slab_pct": gst_slab_pct,
        "breakdown": {
            "subtotal": f"{final_subtotal:.{minor_exponent}f}" if minor_exponent > 0 else f"{int(final_subtotal)}",
            "rate_plan_delta": f"{final_delta:.{minor_exponent}f}" if minor_exponent > 0 else f"{int(final_delta)}",
            "tax_gst": f"{final_gst:.{minor_exponent}f}" if minor_exponent > 0 else f"{int(final_gst)}",
            "total": f"{target_total:.{minor_exponent}f}" if minor_exponent > 0 else f"{int(target_total)}",
        },
        "formatted": {
            "subtotal": format_currency_string(final_subtotal, currency_symbol, minor_exponent, display_locale),
            "rate_plan_delta": format_currency_string(final_delta, currency_symbol, minor_exponent, display_locale),
            "tax_gst": format_currency_string(final_gst, currency_symbol, minor_exponent, display_locale),
            "total": format_currency_string(target_total, currency_symbol, minor_exponent, display_locale),
        },
        "apportionment_method": "largest_remainder",
    }
