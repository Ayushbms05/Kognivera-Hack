import urllib.request
import json

# 1. Test Backend API Endpoint
url = "http://127.0.0.1:8000/api/hotels/htl_06d140bd/proximity"
with urllib.request.urlopen(url) as response:
    status = response.status
    data = json.loads(response.read().decode('utf-8'))

print("=== 1. Backend Proximity API ===")
print("HTTP Status:", status)
print("Keys:", list(data.keys()))
print("Hotel ID:", data["hotel_id"])
print("Coordinates:", data["coordinates"])
print("Walkability Score:", data["walkability_score"])
print("Walkable Landmarks Count:", len(data["walkable_landmarks"]))
assert status == 200
assert "coordinates" in data
assert "walkable_landmarks" in data
assert "walkability_score" in data
assert len(data["walkable_landmarks"]) > 0

# 2. Test Frontend Search Page
search_url = "http://localhost:3001/search?city=Jaipur"
req = urllib.request.Request(search_url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as response:
    f_status = response.status
    f_html = response.read().decode('utf-8')

print("\n=== 2. Frontend Search Page ===")
print("HTTP Status:", f_status)
print("Contains MapLibre / Map Container:", "maplibre" in f_html.lower() or "map" in f_html.lower())

# 3. Test Frontend Hotel Detail Page
hotel_url = "http://localhost:3001/hotel/htl_06d140bd"
req = urllib.request.Request(hotel_url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as response:
    h_status = response.status
    h_html = response.read().decode('utf-8')

print("\n=== 3. Frontend Hotel Detail Page ===")
print("HTTP Status:", h_status)
print("Contains Walk Score / Walkability:", "Walk Score" in h_html or "Walkability" in h_html)
assert h_status == 200

print("\nALL TESTS PASSED SUCCESSFULLY!")
