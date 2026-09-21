import pandas as pd
import sqlite3
import os

RATES_TO_INR = {
    "INR": 1.0,
    "USD": 83.333333,
    "EUR": 90.909091,
    "GBP": 105.263158,
    "AED": 22.727273,
    "SGD": 62.5,
    "THB": 2.380952,
    "LKR": 0.275,
    "NPR": 0.625,
    "BTN": 1.0,
    "MVR": 5.4,
    "JPY": 0.549451,
    "KRW": 0.062,
    "KWD": 271.5,
    "BHD": 221.0,
    "AUD": 55.555556,
    "CAD": 62.5,
    "CHF": 94.5,
    "MYR": 18.2,
    "IDR": 0.0053,
    "VND": 0.0034,
    "CNY": 11.5,
    "QAR": 22.88,
    "SAR": 22.22,
    "NZD": 51.2,
}

csv_paths = ['backend/data/csv/02_currencies.csv', 'StayFinder/data/csv/02_currencies.csv']

for path in csv_paths:
    if os.path.exists(path):
        df = pd.read_csv(path)
        # Ensure code column exists
        if 'code' not in df.columns:
            df['code'] = df['iso4217']
        # Add exchange_rate_to_inr
        df['exchange_rate_to_inr'] = df['iso4217'].map(lambda c: RATES_TO_INR.get(c, 1.0))
        # Keep canonical column names present
        # Canonical: currency_id, iso4217, name, symbol, minor_unit_exponent, display_locale, updated_at
        df.to_csv(path, index=False)
        print(f"Enriched {path}: {len(df)} rows")

# Also update SQLite databases
db_paths = ['backend/data/PS-02.db', 'PS-02.db', 'StayFinder/data/PS-02.db']
for db_p in db_paths:
    if os.path.exists(db_p):
        conn = sqlite3.connect(db_p)
        cur = conn.cursor()
        cols = [r[1] for r in cur.execute("PRAGMA table_info(currencies)").fetchall()]
        if 'code' not in cols:
            cur.execute("ALTER TABLE currencies ADD COLUMN code TEXT")
        if 'exchange_rate_to_inr' not in cols:
            cur.execute("ALTER TABLE currencies ADD COLUMN exchange_rate_to_inr REAL")
        for code, rate in RATES_TO_INR.items():
            cur.execute("UPDATE currencies SET code = ?, exchange_rate_to_inr = ? WHERE iso4217 = ?", (code, rate, code))
        conn.commit()
        conn.close()
        print(f"Updated SQLite currencies in {db_p}")

print("Currency enrichment complete.")
