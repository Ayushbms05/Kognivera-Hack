"""
Script to enrich CSV datasets with required fields:
1. 14_trips.csv: add duration_days and travel_style
2. 08_hotels.csv: add latitude and longitude
3. 19_itineraries.csv: add day_number, activity_title, description, time_slot
"""
import pandas as pd
import numpy as np
import json, os, hashlib

# Load files
trips_path = "backend/data/csv/14_trips.csv"
users_path = "backend/data/csv/09_users.csv"
hotels_path = "backend/data/csv/08_hotels.csv"
cities_path = "backend/data/csv/06_cities.csv"
itin_path = "backend/data/csv/19_itineraries.csv"

df_trips = pd.read_csv(trips_path)
df_users = pd.read_csv(users_path)
df_hotels = pd.read_csv(hotels_path)
df_cities = pd.read_csv(cities_path)
df_itin = pd.read_csv(itin_path)

# 1. Enrich 14_trips.csv
# duration_days
if "duration_days" not in df_trips.columns:
    d1 = pd.to_datetime(df_trips["start_date"])
    d2 = pd.to_datetime(df_trips["end_date"])
    df_trips["duration_days"] = (d2 - d1).dt.days.clip(lower=1)

# travel_style from user or trip_type
if "travel_style" not in df_trips.columns:
    user_style_map = dict(zip(df_users["user_id"], df_users["travel_style"]))
    df_trips["travel_style"] = df_trips["owner_user_id"].map(user_style_map).fillna("cultural")

df_trips.to_csv(trips_path, index=False)
df_trips.to_csv("StayFinder/data/csv/14_trips.csv", index=False)
print("Updated 14_trips.csv with duration_days and travel_style.")

# 2. Enrich 08_hotels.csv with latitude and longitude
if "latitude" not in df_hotels.columns:
    df_hotels["latitude"] = df_hotels["lat"]
if "longitude" not in df_hotels.columns:
    df_hotels["longitude"] = df_hotels["lng"]

df_hotels.to_csv(hotels_path, index=False)
df_hotels.to_csv("StayFinder/data/csv/08_hotels.csv", index=False)
print("Updated 08_hotels.csv with latitude and longitude.")

# 3. Enrich 19_itineraries.csv
# Real destination activities for cities
CITY_ACTIVITIES = {
    "Jaipur": [
        ("Amber Palace & Fort Sunrise Walk", "Ascend the iconic Maota lake ramparts at dawn and witness royal Rajput architecture.", "morning", "cultural"),
        ("Hawa Mahal & Old City Heritage Walk", "Explore the honeycomb facade of the Palace of Winds, local spice markets, and lac bangle stalls.", "morning", "cultural"),
        ("City Palace & Jantar Mantar Observatory", "Discover royal ceremonial courtyards, the Peacock Gate, and giant astronomical stone sundials.", "afternoon", "cultural"),
        ("Nahargarh Fort Sunset & Wax Museum", "Panoramic views of the Pink City skyline perched along the Aravalli hill ridges.", "afternoon", "adventure"),
        ("Johari Bazaar Street Food & Gem Trail", "Indulge in authentic Pyaaz Kachori, rabri ghevar, and handcrafted silver jewellery.", "evening", "culinary"),
        ("Chokhi Dhani Ethnic Rajasthani Village", "Immersive cultural performances, Kalbeliya folk dances, camel rides, and traditional thali.", "evening", "cultural"),
        ("Jal Mahal & Man Sagar Lakeside Stroll", "Picturesque submerged water palace views with artisan block-printing craft workshops.", "morning", "slow"),
        ("Albert Hall Museum & Ram Niwas Garden", "Indo-Saracenic architectural masterpiece showcasing Persian carpets and miniature paintings.", "afternoon", "cultural"),
        ("Jaigarh Fort & Jaivana Cannon Tour", "Inspect the world's largest cannon on wheels and military ramparts overlooking Amber.", "evening", "adventure"),
    ],
    "Udaipur": [
        ("Lake Pichola Morning Boat Cruise", "Tranquil waters reflecting Jag Mandir and the Aravalli hills in soft golden morning sunlight.", "morning", "cultural"),
        ("City Palace Museum & Crystal Gallery", "Marvel at intricate Mewar mirror mosaics, Mor Chowk, and centuries of royal heritage.", "afternoon", "cultural"),
        ("Bagore Ki Haveli Evening Dharohar Dance", "Mesmerizing Rajasthani folk dance, puppet shows, and fire dancers right by Gangaur Ghat.", "evening", "cultural"),
        ("Jagdish Temple & Heritage Old City Walk", "17th-century Indo-Aryan carved stone temple and bustling silver artisan lanes.", "morning", "cultural"),
        ("Saheliyon Ki Bari & Fountains Walk", "Lush ornamental courtyard built for royal maidens with marble elephants and lotus pools.", "afternoon", "slow"),
        ("Ambrai Ghat Waterfront Dining", "Dine under palace floodlights with candlelit tables overlooking the illuminated lake.", "evening", "culinary"),
        ("Monsoon Palace (Sajjangarh) Peak Trek", "Panoramic hilltop fortress offering breathtaking sunset views of Udaipur's lakes.", "morning", "adventure"),
        ("Shilpgram Rural Arts & Crafts Complex", "Living ethnographic museum of traditional tribal huts, pottery workshops, and folk music.", "afternoon", "cultural"),
        ("Fateh Sagar Lake Promenade & Street Food", "Sample fresh cold coffee, kulhad chai, and spicy pav bhaji along the lakeside drive.", "evening", "culinary"),
    ],
    "Varanasi": [
        ("Subah-e-Banaras Dawn Boat Ride", "Glide between Assi Ghat and Dashashwamedh witnessing morning Vedic chants and sacred rituals.", "morning", "cultural"),
        ("Kashi Vishwanath Corridor & Golden Temple", "Historic spiritual sanctum dedicated to Lord Shiva with newly restored heritage walkways.", "afternoon", "cultural"),
        ("Grand Ganga Maha Aarti at Dashashwamedh", "Multi-tiered brass incense lamps, resonating conch shells, and spiritual grandeur.", "evening", "cultural"),
        ("Sarnath Deer Park & Dhamek Stupa", "Sacred site where Lord Buddha delivered his first sermon, featuring Ashoka Pillar relics.", "morning", "slow"),
        ("Banarasi Silk Weaving Quarter Exploration", "Visit master weavers creating intricate gold and silver zari brocade handloom sarees.", "afternoon", "cultural"),
        ("Kachori Gali & Blue Lassi Culinary Walk", "Relish piping-hot puris, malaiyo winter foam dessert, and authentic clay pot lassis.", "evening", "culinary"),
        ("Assi Ghat Yoga & Classical Music Morning", "Start the day with peaceful sunrise Surya Namaskar sessions overlooking Mother Ganga.", "morning", "wellness"),
        ("Bharat Kala Bhavan Archaeological Museum", "BHU campus treasure trove of terracotta figurines, miniature art, and ancient manuscripts.", "afternoon", "cultural"),
        ("Manikarnika & Harishchandra Ghat Boat Tour", "Sobering and profound philosophical insight into Varanasi's timeless cremation traditions.", "evening", "cultural"),
    ],
    "Goa": [
        ("Fontainhas Latin Quarter Heritage Walk", "Pastel Portuguese villas, vintage azulejos ceramic tiles, and quaint art cafes.", "morning", "cultural"),
        ("Spice Plantation Tour & Authentic Goan Lunch", "Aromatic vanilla, cinnamon, and peri-peri cultivation in Sahakari with traditional feni tasting.", "afternoon", "culinary"),
        ("Sunset Mandovi River Catamaran Cruise", "Live Goan folk music, Dekhni dance performances, and sunset vistas along the Arabian Sea.", "evening", "slow"),
        ("Basilica of Bom Jesus & Old Goa Churches", "UNESCO World Heritage site housing the sacred relics of St. Francis Xavier.", "morning", "cultural"),
        ("Fort Aguada & Lighthouse Coastal Trek", "17th-century Portuguese fortress overlooking Sinquerim beach and the vast ocean.", "afternoon", "adventure"),
        ("Anjuna / Vagator Cliffside Sunset Lounge", "Eclectic beats, seaside dining, and vibrant bohemian sunset gatherings.", "evening", "luxury"),
        ("Dudhsagar Waterfalls Safari & Jeep Trek", "Spectacular four-tiered milky cascade nestled in the dense Western Ghats canopy.", "morning", "adventure"),
        ("Divar Island Cycling & Village Discovery", "Pristine mangrove islands, ancient churches, and serene slow-paced riverine village life.", "afternoon", "slow"),
        ("Curlies & Tito's Lane Coastal Night Experience", "Lively beachfront shacks, fresh seafood barbecue, and energetic coastal vibes.", "evening", "adventure"),
    ],
    "New Delhi": [
        ("Heritage Walk of Lodhi Gardens & Tombs", "Stroll through 15th-century Sayyid and Lodhi dynasty mausoleums amidst lush lawns.", "morning", "slow"),
        ("Qutub Minar & Mehrauli Archaeological Park", "Towering 73-meter minaret and historic sandstone ruins spanning a millennium.", "afternoon", "cultural"),
        ("Chandni Chowk Street Food & Jama Masjid", "Old Delhi culinary safari tasting daulat ki chaat, paranthe, and kebabs.", "evening", "culinary"),
        ("Humayun's Tomb Garden Complex", "Sublime precursor to the Taj Mahal showcasing Persian charbagh symmetry.", "morning", "cultural"),
        ("National Museum & Kartavya Path Stroll", "Inspect Indus Valley Harappan relics, bronze Chola deities, and India Gate.", "afternoon", "cultural"),
        ("Dilli Haat Crafts Bazaar & Regional Diners", "Artisans from all 28 states selling handcrafted textiles and authentic regional delicacies.", "evening", "culinary"),
        ("Sunder Nursery Biodiversity & Heritage Park", "Restored Mughal garden paradise with tranquil ponds, rare trees, and weekend farmers market.", "morning", "wellness"),
        ("Red Fort & Lahori Gate Historical Tour", "Magnificent red sandstone citadel from which Mughal emperors ruled Hindustan.", "afternoon", "cultural"),
        ("Hauz Khas Village Lakeside & Sunset Cafes", "Chic boutiques and medieval madrassa ruins overlooking a tranquil deer park reservoir.", "evening", "comfort"),
    ],
    "Mumbai": [
        ("Gateway of India & Colaba Heritage Trail", "Iconic seaside arch overlooking Mumbai harbor followed by Victorian Gothic architecture.", "morning", "cultural"),
        ("Chhatrapati Shivaji Maharaj Vastu Museum", "Indo-Saracenic museum housing miniature paintings, weaponry, and world art.", "afternoon", "cultural"),
        ("Marine Drive 'Queen's Necklace' Sunset Stroll", "Breezy seaside promenade lined with Art Deco buildings and vibrant street life.", "evening", "slow"),
        ("Elephanta Caves Island Rock-Cut Temples", "Ferry journey across the Arabian Sea to 5th-century rock-cut Shiva sculptures.", "morning", "adventure"),
        ("Kala Ghoda Art Precinct & Heritage Cafes", "Bohemian neighborhood filled with contemporary art galleries and historic Irani cafes.", "afternoon", "cultural"),
        ("Bandra Bandstand & Carter Road Sunset Walk", "Celebrity bungalows, sea-facing promenade, and cosmopolitan rooftop dining.", "evening", "luxury"),
        ("Sanjay Gandhi National Park & Kanheri Caves", "Lush urban national park featuring ancient Buddhist rock-cut monasteries.", "morning", "adventure"),
        ("Crawford Market & Mangaldas Cloth Bazaar", "Whirlwind sensory journey through historic spice, fruit, and textile trading halls.", "afternoon", "cultural"),
        ("Juhu Beach Sunset & Pav Bhaji Feast", "Iconic Mumbai beach teeming with families, bhelpuri stalls, and seaside ambiance.", "evening", "culinary"),
    ]
}

# Generic fallback template by travel style for cities not explicitly listed
STYLE_TEMPLATES = {
    "cultural": [
        ("Historic Citadel & Royal Palace Morning Tour", "Explore ancient battlements, royal courtyards, and museum galleries preserving centuries of heritage.", "morning"),
        ("Old Town Heritage Bazaar & Artisan Lane", "Wander vibrant alleys filled with master craftsmen, traditional weaving, and regional metalware.", "afternoon"),
        ("Traditional Folk Performance & Heritage Feast", "Delight in live classical musical performances accompanied by multi-course regal recipes.", "evening"),
    ],
    "adventure": [
        ("Sunrise Ridge Hike & Panoramic Viewpoint", "Venture along scenic hillside trails offering uninhibited dawn views of the surrounding valleys.", "morning"),
        ("River Expedition & Nature Wilderness Trek", "Active outdoor excursion exploring gorges, hidden waterfalls, and indigenous wildlife habitats.", "afternoon"),
        ("Campfire Astronomy & Stargazing Session", "Gather under clear celestial skies for stargazing and stories of regional explorer folklore.", "evening"),
    ],
    "wellness": [
        ("Dawn Meditation & Pranayama in Garden Pavilions", "Begin the day revitalized with guided breathwork and gentle yoga in a peaceful courtyard.", "morning"),
        ("Ayurvedic Herbal Therapy & Botanical Walk", "Learn about restorative medicinal herbs followed by traditional warm oil relaxation rituals.", "afternoon"),
        ("Tranquil Waterfront Sunset & Sound Bath", "Soothing therapeutic singing bowls and herbal teas overlooking shimmering evening waters.", "evening"),
    ],
    "culinary": [
        ("Old Market Breakfast & Fresh Spice Trail", "Taste signature morning breakfast specialties and browse aromatic pepper and cardamom stalls.", "morning"),
        ("Hands-on Regional Cooking Masterclass", "Cook authentic recipes alongside veteran local chefs using freshly ground heritage masalas.", "afternoon"),
        ("Iconic Street Food Safari & Night Market", "Sample legendary savory street chaats, slow-cooked royal delicacies, and sweet confections.", "evening"),
    ],
    "slow": [
        ("Botanical Gardens & Heritage Tea Stroll", "Gentle morning stroll under ancient canopy trees enjoying freshly brewed estate single-origin teas.", "morning"),
        ("Artisan Pottery Workshop & Museum Visit", "Observe heritage clay craftsmanship and unhurriedly tour curated regional art collections.", "afternoon"),
        ("Lakeside Promenade Sunset & Classical Sitar", "Unwind as dusk falls with soft breeze, shimmering reflections, and ambient acoustic music.", "evening"),
    ],
    "luxury": [
        ("Private Chauffeur Landmark & Palace Tour", "VIP skip-the-line access to private palace wings and exclusive curatorial collections.", "morning"),
        ("Fine Dining Luncheon & Vintage High Tea", "Sample gourmet fusion gastronomy followed by an opulent afternoon tea service.", "afternoon"),
        ("Exclusive Sunset Cruise & Chef's Degustation", "Private boat charter with champagne sunset toasts and an artisanal seven-course meal.", "evening"),
    ],
    "budget": [
        ("Self-Guided Architectural Walking Trail", "Explore iconic historic facades, public clocktowers, and photogenic heritage gates on foot.", "morning"),
        ("Public Park Relaxation & City Museum", "Admire civic historical collections and picnic amidst manicured public historical gardens.", "afternoon"),
        ("Bustling Night Bazaar & Budget Food Street", "Enjoy mouthwatering local street snacks and soak in vibrant local street energy.", "evening"),
    ]
}

# Merge trip info into itineraries
city_id_map = dict(zip(df_cities["city_id"], df_cities["name"]))
trip_city_map = dict(zip(df_trips["trip_id"], df_trips["destination_city_id"]))
trip_style_map = dict(zip(df_trips["trip_id"], df_trips["travel_style"]))

day_numbers = []
titles = []
descriptions = []
time_slots = []

# Group itineraries by trip
for idx, row in df_itin.iterrows():
    trip_id = row["trip_id"]
    city_id = trip_city_map.get(trip_id, "cty_c07454f1")
    city_name = city_id_map.get(city_id, "Jaipur")
    style = trip_style_map.get(trip_id, "cultural")
    
    # Pick from city specific or style fallback
    city_pool = CITY_ACTIVITIES.get(city_name)
    slot_cycle = ["morning", "afternoon", "evening"]
    day_cycle = [1, 2, 3]
    
    act_idx = idx % 9
    day_val = (act_idx // 3) + 1
    slot_val = slot_cycle[act_idx % 3]
    
    if city_pool and len(city_pool) > act_idx:
        title, desc, s_type = city_pool[act_idx][0], city_pool[act_idx][1], city_pool[act_idx][2]
        slot_val = s_type
    else:
        style_pool = STYLE_TEMPLATES.get(style, STYLE_TEMPLATES["cultural"])
        tmpl = style_pool[(act_idx % 3)]
        title = f"{city_name} {tmpl[0]}"
        desc = f"In {city_name}: {tmpl[1]}"
        slot_val = tmpl[2]
        
    day_numbers.append(day_val)
    titles.append(title)
    descriptions.append(desc)
    time_slots.append(slot_val)

df_itin["day_number"] = day_numbers
df_itin["activity_title"] = titles
df_itin["description"] = descriptions
df_itin["time_slot"] = time_slots

df_itin.to_csv(itin_path, index=False)
df_itin.to_csv("StayFinder/data/csv/19_itineraries.csv", index=False)
print("Updated 19_itineraries.csv with day_number, activity_title, description, and time_slot!")
