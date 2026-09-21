import sqlite3
import pandas as pd
import numpy as np
import math
import uuid

# Load cities and hotels
cities_df = pd.read_csv('backend/data/csv/06_cities.csv')
hotels_df = pd.read_csv('backend/data/csv/08_hotels.csv')

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return 2 * R * math.asin(math.sqrt(a))

# Real landmark names and transit hubs by city name
CITY_LANDMARKS = {
    "Jaipur": [
        ("Hawa Mahal", "heritage", 26.9239, 75.8267),
        ("City Palace", "heritage", 26.9258, 75.8237),
        ("Albert Hall Museum", "museum", 26.9116, 75.8195),
        ("Jaipur Junction Railway Station", "transit_hub", 26.9200, 75.7878),
        ("Chandpole Metro Station", "transit_hub", 26.9248, 75.8085),
        ("Bapu Bazaar", "bazaar", 26.9197, 75.8236),
        ("Jantar Mantar", "heritage", 26.9247, 75.8245),
        ("Sindhi Camp Bus Station", "transit_hub", 26.9221, 75.7989),
    ],
    "Udaipur": [
        ("City Palace Udaipur", "heritage", 24.5764, 73.6835),
        ("Lake Pichola Promenade", "attraction", 24.5753, 73.6766),
        ("Jagdish Temple", "heritage", 24.5794, 73.6841),
        ("Bagore Ki Haveli", "museum", 24.5799, 73.6809),
        ("Saheliyon Ki Bari", "park", 24.6033, 73.6874),
        ("Udaipur City Railway Station", "transit_hub", 24.5707, 73.6987),
        ("Fateh Sagar Lake Viewpoint", "viewpoint", 24.6025, 73.6738),
    ],
    "Jodhpur": [
        ("Mehrangarh Fort", "heritage", 26.2978, 73.0185),
        ("Jaswant Thada", "heritage", 26.3025, 73.0244),
        ("Umaid Bhawan Palace", "heritage", 26.2808, 73.0475),
        ("Ghanta Ghar Clock Tower", "bazaar", 26.2954, 73.0252),
        ("Jodhpur Junction Railway Station", "transit_hub", 26.2858, 73.0203),
        ("Mandore Gardens", "park", 26.3575, 73.0414),
    ],
    "Jaisalmer": [
        ("Jaisalmer Fort", "heritage", 26.9124, 70.9127),
        ("Patwon Ki Haveli", "heritage", 26.9161, 70.9169),
        ("Gadisar Lake", "attraction", 26.9083, 70.9238),
        ("Jaisalmer Railway Station", "transit_hub", 26.9179, 70.9272),
        ("Sam Sand Dunes Gateway", "viewpoint", 26.8322, 70.5180),
    ],
    "Agra": [
        ("Taj Mahal", "heritage", 27.1751, 78.0421),
        ("Agra Fort", "heritage", 27.1795, 78.0211),
        ("Mehtab Bagh", "park", 27.1800, 78.0422),
        ("Agra Cantt Railway Station", "transit_hub", 27.1583, 78.0100),
        ("Kinari Bazaar", "bazaar", 27.1867, 78.0167),
        ("Fatehpur Sikri Road Junction", "transit_hub", 27.1650, 77.9950),
    ],
    "Varanasi": [
        ("Dashashwamedh Ghat", "heritage", 25.3074, 83.0104),
        ("Kashi Vishwanath Temple", "religious", 25.3109, 83.0107),
        ("Assi Ghat", "attraction", 25.2891, 83.0068),
        ("Manikarnika Ghat", "heritage", 25.3108, 83.0139),
        ("Varanasi Junction Station", "transit_hub", 25.3283, 82.9866),
        ("Godowlia Market Crossroad", "bazaar", 25.3089, 83.0067),
    ],
    "New Delhi": [
        ("India Gate", "heritage", 28.6129, 77.2295),
        ("Connaught Place Inner Circle", "bazaar", 28.6327, 77.2197),
        ("Rajiv Chowk Metro Station", "transit_hub", 28.6328, 77.2195),
        ("New Delhi Railway Station", "transit_hub", 28.6430, 77.2194),
        ("Red Fort", "heritage", 28.6562, 77.2410),
        ("Humayun Tomb", "heritage", 28.5933, 77.2507),
        ("Lodhi Garden", "park", 28.5931, 77.2219),
    ],
    "Mumbai": [
        ("Gateway of India", "heritage", 18.9220, 72.8347),
        ("Marine Drive Promenade", "attraction", 18.9432, 72.8230),
        ("Chhatrapati Shivaji Maharaj Terminus (CSMT)", "transit_hub", 18.9400, 72.8353),
        ("Colaba Causeway Market", "bazaar", 18.9189, 72.8300),
        ("Churchgate Railway Station", "transit_hub", 18.9322, 72.8264),
        ("Crawford Market", "bazaar", 18.9472, 72.8344),
        ("Bandra Bandstand", "viewpoint", 19.0465, 72.8197),
    ],
    "Bengaluru": [
        ("Cubbon Park", "park", 12.9763, 77.5929),
        ("MG Road Metro Station", "transit_hub", 12.9756, 77.6066),
        ("Bangalore Palace", "heritage", 12.9988, 77.5921),
        ("Lalbagh Botanical Garden", "park", 12.9507, 77.5848),
        ("Krantivira Sangolli Rayanna Railway Station", "transit_hub", 12.9781, 77.5694),
        ("Brigade Road Commercial Hub", "bazaar", 12.9738, 77.6075),
    ],
    "Kolkata": [
        ("Victoria Memorial", "heritage", 22.5448, 88.3426),
        ("Howrah Railway Terminus", "transit_hub", 22.5839, 88.3431),
        ("Park Street Cultural Corridor", "bazaar", 22.5516, 88.3524),
        ("Esplanade Metro Interchange", "transit_hub", 22.5647, 88.3516),
        ("Howrah Bridge", "heritage", 22.5851, 88.3468),
        ("Indian Museum", "museum", 22.5579, 88.3511),
    ],
    "Hyderabad": [
        ("Charminar", "heritage", 17.3616, 78.4747),
        ("Golconda Fort", "heritage", 17.3833, 78.4011),
        ("Hussain Sagar Lake Promenade", "attraction", 17.4239, 78.4738),
        ("Secunderabad Railway Station", "transit_hub", 17.4334, 78.5044),
        ("HITEC City Metro Station", "transit_hub", 17.4489, 78.3772),
        ("Laad Bazaar", "bazaar", 17.3619, 78.4735),
    ],
    "Chennai": [
        ("Marina Beach Promenade", "attraction", 13.0500, 80.2824),
        ("Kapaleeshwarar Temple", "religious", 13.0334, 80.2705),
        ("Chennai Central Railway Station", "transit_hub", 13.0823, 80.2755),
        ("Fort St. George", "heritage", 13.0799, 80.2878),
        ("Government Museum Egmore", "museum", 13.0784, 80.2608),
    ],
    "Panaji": [
        ("Church of Our Lady of the Immaculate Conception", "heritage", 15.4989, 73.8290),
        ("Fontainhas Latin Quarter", "heritage", 15.4947, 73.8322),
        ("Miramar Beach Promenade", "attraction", 15.4833, 73.8055),
        ("KTC Panaji Bus Terminal", "transit_hub", 15.4982, 73.8375),
        ("Mandovi River Cruise Jetty", "transit_hub", 15.4998, 73.8306),
        ("Dona Paula Viewpoint", "viewpoint", 15.4536, 73.8028),
    ],
}

print(f"Predefined detailed city templates: {len(CITY_LANDMARKS)}")
