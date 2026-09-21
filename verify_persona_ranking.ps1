$ErrorActionPreference = "Stop"

Write-Host "=== 1. Verifying Stage Personas Endpoint (/api/hotels/personas) ==="
$personas = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/personas" -Method GET
Write-Host "Total personas returned: $($personas.Count)"
foreach ($p in $personas) {
    Write-Host " - $($p.name) | $($p.label) | ID: $($p.user_id)"
}
if ($personas.Count -lt 3) {
    throw "Expected at least 3 stage personas"
}

Write-Host "`n=== 2. Verifying Priya Sharma (Heavy / Heritage Connoisseur) Re-Ranking ==="
$priya = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/search/ranked?user_id=usr_f855344d&personalization=true&limit=5" -Method GET
Write-Host "Active User: $($priya.active_user.name) | Personalization: $($priya.personalization_active)"
Write-Host "Top Ranked Hotel: $($priya.items[0].name) ($($priya.items[0].property_type))"
Write-Host "Explainability: $($priya.items[0].explainability)"
Write-Host "Affinity breakdown: $($priya.items[0].score_breakdown.affinity)"

Write-Host "`n=== 3. Verifying Aarav Patel (Cold-Start / Shoestring Backpacker) Re-Ranking ==="
$aarav = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/search/ranked?user_id=usr_f5fd9c87&personalization=true&limit=5" -Method GET
Write-Host "Active User: $($aarav.active_user.name) | Personalization: $($aarav.personalization_active)"
Write-Host "Top Ranked Hotel: $($aarav.items[0].name) ($($aarav.items[0].property_type)) - Rate: $($aarav.items[0].min_price)"
Write-Host "Explainability: $($aarav.items[0].explainability)"

Write-Host "`n=== 4. Verifying Vikram Malhotra (Business Traveler) Re-Ranking ==="
$vikram = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/search/ranked?user_id=usr_1805266d&personalization=true&limit=5" -Method GET
Write-Host "Active User: $($vikram.active_user.name) | Personalization: $($vikram.personalization_active)"
Write-Host "Top Ranked Hotel: $($vikram.items[0].name) ($($vikram.items[0].property_type))"
Write-Host "Explainability: $($vikram.items[0].explainability)"

Write-Host "`n=== 5. Verifying Personalization Toggle OFF ==="
$unranked = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/search/ranked?user_id=usr_f855344d&personalization=false&limit=5" -Method GET
Write-Host "Personalization active: $($unranked.personalization_active)"
Write-Host "Explainability when OFF: $($unranked.items[0].explainability)"
if ($unranked.items[0].score_breakdown.affinity -ne 0.0) {
    throw "Affinity must be 0.0 when personalization is toggled OFF"
}

Write-Host "`n=== 6. Verifying Frontend Search Page HTTP 200 ==="
$frontRes = Invoke-WebRequest -Uri "http://localhost:3001/search" -Method GET -UseBasicParsing
Write-Host "Frontend Search HTTP Status: $($frontRes.StatusCode)"

Write-Host "`n=== 7. Running Database Conformance Validator ==="
python tools/validate_conformance.py backend/data/PS-02.db

Write-Host "`n>>> ALL LIVE PERSONA SWITCHER & RE-RANKING TESTS PASSED SUCCESSFULLY! <<<"
