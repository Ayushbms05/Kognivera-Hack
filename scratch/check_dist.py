import pandas as pd
import math

hotels = pd.read_csv('backend/data/csv/08_hotels.csv')
cities = pd.read_csv('backend/data/csv/06_cities.csv')

print(f"Total hotels: {len(hotels)}, Total cities: {len(cities)}")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return 2 * R * math.asin(math.sqrt(a))

merged = hotels.merge(cities, on='city_id', suffixes=('_hotel', '_city'))
merged['calc_dist'] = merged.apply(lambda r: haversine(r['lat_hotel'], r['lng_hotel'], r['lat_city'], r['lng_city']), axis=1)

print("Distance to city center stats:")
print(merged['calc_dist'].describe())
