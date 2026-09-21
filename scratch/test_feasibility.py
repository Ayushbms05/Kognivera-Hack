import urllib.request
import json

def test_feasibility(hotel_id, name, payload):
    url = f"http://127.0.0.1:8000/api/hotels/{hotel_id}/check-feasibility"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print(f"\n==========================================")
        print(f"SCENARIO: {name} on {hotel_id}")
        print(f"Overall Feasible: {res['overall_feasible']}")
        print(f"Verdict: {res['verdict_summary']}")
        print(f"------------------------------------------")
        for r in res['rules']:
            print(f"[{r['status']}] {r['parameter']} ({r['source_column']}): {r['hotel_rule']}")

# Hotel htl_06d140bd has:
# child_policy: "Suitable for children over 8 only..."
# pet_policy: "Pet friendly throughout..."
# early_checkin_possible: 0
# checkin_time: "14:00"

test_feasibility("htl_06d140bd", "Late Arrival (2:30 AM)", {
    "arrival_time": "02:30",
    "has_pets": False,
    "children_ages": [],
    "adults_count": 2
})

test_feasibility("htl_06d140bd", "Traveling with Cat", {
    "arrival_time": None,
    "has_pets": True,
    "children_ages": [],
    "adults_count": 2
})

test_feasibility("htl_06d140bd", "Family with Toddler & 10yo", {
    "arrival_time": "14:00",
    "has_pets": False,
    "children_ages": [2, 10],
    "adults_count": 2
})
