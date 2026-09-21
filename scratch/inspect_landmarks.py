import sqlite3
import os
import glob
import pandas as pd

conn = sqlite3.connect('backend/data/PS-02.db')
cursor = conn.cursor()
tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("SQLite Tables:", tables)
print("sf_landmarks in db:", 'sf_landmarks' in tables)

csv_files = glob.glob('backend/data/csv/*.csv')
print("CSV files:", [os.path.basename(f) for f in csv_files])

# Check cities and hotels
cities_df = pd.read_csv('backend/data/csv/06_cities.csv')
print("Cities count:", len(cities_df))
print("Cities columns:", list(cities_df.columns))

hotels_df = pd.read_csv('backend/data/csv/08_hotels.csv')
print("Hotels count:", len(hotels_df))
print("Hotels columns:", list(hotels_df.columns))
