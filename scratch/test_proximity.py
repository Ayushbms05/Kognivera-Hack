import urllib.request
import json

url = 'http://127.0.0.1:8000/api/hotels/htl_06d140bd/proximity'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    status = response.status
    data = json.loads(response.read().decode('utf-8'))

print("Status:", status)
print("Keys:", list(data.keys()))
print("Hotel ID:", data["hotel_id"])
print("Coordinates:", data["coordinates"])
print("Walkability score:", data["walkability_score"])
print("Walkable landmarks count:", len(data["walkable_landmarks"]))
for lm in data["walkable_landmarks"]:
    print(f"  * {lm['name']} | {lm['kind']} | {lm['distance_km']} km | {lm['walk_time_minutes']} min | coords: ({lm['lat']}, {lm['lng']})")

print("Isochrone 1.5km vertices:", len(data["isochrone_1_5km"]["coordinates"][0]))
print("Transit landmarks 5km count:", len(data["transit_landmarks_5km"]))
