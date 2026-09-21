import urllib.request
import json

def test_persona(user_id, name, personalization=True):
    url = f"http://127.0.0.1:8000/api/hotels/search/ranked?user_id={user_id}&personalization={str(personalization).lower()}&limit=4"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read().decode())
        print(f"\n==========================================")
        print(f"PERSONA: {name} (ID: {user_id}) | Personalization: {personalization}")
        print(f"Key weights: {data['active_user'].get('key_weights')}")
        print(f"------------------------------------------")
        for item in data['items']:
            print(f"Rank {item['personalization_rank']}: {item['name']} ({item['property_type']}) - INR {item.get('min_price')} | Score: {item['final_score']}")
            print(f"   Breakdown: {item['score_breakdown']}")
            print(f"   Reason: {item['explainability']}")

test_persona("usr_f855344d", "Priya Sharma (Heritage)", True)
test_persona("usr_f5fd9c87", "Aarav Patel (Shoestring Backpacker)", True)
test_persona("usr_1805266d", "Vikram Malhotra (Business Traveler)", True)
test_persona("usr_f855344d", "Priya Sharma (Personalization OFF)", False)
