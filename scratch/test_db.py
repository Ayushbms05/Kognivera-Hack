import sqlite3

conn = sqlite3.connect("backend/data/PS-02.db")
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", [r[0] for r in c.fetchall()])
