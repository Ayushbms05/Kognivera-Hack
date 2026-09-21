"""
Currencies API — multi-currency exchange rates and display formatting.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
import aiosqlite

from core.database import get_db
from core.schemas import CurrencyItem, CurrenciesListResponse

router = APIRouter(prefix="/api/currencies", tags=["currencies"])

# Benchmark exchange rates against 1 INR (Base currency)
FX_RATES_TO_INR = {
    "INR": 1.0,
    "USD": 0.012,      # ~₹83.3 per USD
    "EUR": 0.011,      # ~₹90.9 per EUR
    "GBP": 0.0095,     # ~₹105.2 per GBP
    "AED": 0.044,      # ~₹22.7 per AED
    "SGD": 0.016,      # ~₹62.5 per SGD
    "THB": 0.42,       # ~₹2.38 per THB
    "JPY": 1.82,       # ~₹0.55 per JPY
    "AUD": 0.018,      # ~₹55.5 per AUD
    "CAD": 0.016,      # ~₹62.5 per CAD
}


@router.get("", response_model=CurrenciesListResponse)
async def list_currencies(db: aiosqlite.Connection = Depends(get_db)):
    """
    Retrieve all supported currencies with exchange rates relative to INR from 02_currencies.csv.
    """
    cursor = await db.execute("""
        SELECT currency_id, iso4217, name, symbol, minor_unit_exponent, display_locale, exchange_rate_to_inr
        FROM currencies
        ORDER BY CASE 
            WHEN iso4217 = 'INR' THEN 1 
            WHEN iso4217 = 'USD' THEN 2 
            WHEN iso4217 = 'EUR' THEN 3 
            WHEN iso4217 = 'GBP' THEN 4
            WHEN iso4217 = 'AED' THEN 5
            WHEN iso4217 = 'SGD' THEN 6
            WHEN iso4217 = 'JPY' THEN 7
            ELSE 8 
        END, iso4217
    """)
    rows = await cursor.fetchall()

    items = []
    for r in rows:
        code = r["iso4217"]
        rate_inr = float(r["exchange_rate_to_inr"] or 1.0)
        # Reciprocal for frontends that multiply: 1 INR = rate_to_inr foreign currency
        reciprocal_rate = round(1.0 / rate_inr, 6) if rate_inr > 0 else 1.0
        
        items.append(CurrencyItem(
            currency_id=r["currency_id"],
            iso4217=code,
            code=code,
            name=r["name"],
            symbol=r["symbol"],
            exchange_rate_to_inr=rate_inr,
            rate_to_inr=reciprocal_rate,
            minor_unit_exponent=int(r["minor_unit_exponent"] if r["minor_unit_exponent"] is not None else 2),
            display_locale=r["display_locale"] or "en-US",
        ))

    return CurrenciesListResponse(
        base_currency="INR",
        currencies=items,
    )
