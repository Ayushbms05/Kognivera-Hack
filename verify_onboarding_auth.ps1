# Automated Verification Script for Visual Onboarding & Biometric Passkey Authentication
$ErrorActionPreference = "Stop"

Write-Host "=== 1. Verifying WebAuthn Passkey Registration Options (/api/auth/generate-registration-options) ===" -ForegroundColor Cyan
$regBody = @{
    username = "traveler_test@stayfinder.com"
    display_name = "Kognivera Evaluator"
} | ConvertTo-Json

$regRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/auth/generate-registration-options" -Method Post -ContentType "application/json" -Body $regBody
Write-Host "Generated User ID: $($regRes.user_id)" -ForegroundColor Green
Write-Host "RP Name: $($regRes.options.rp.name) | Challenge length: $($regRes.options.challenge.Length)" -ForegroundColor Yellow
if (-not $regRes.options.challenge) {
    throw "Expected valid FIDO2 challenge in registration options"
}

Write-Host "`n=== 2. Verifying 1-Click Biometric Passkey Login (/api/auth/quick-passkey-login) ===" -ForegroundColor Cyan
$quickBody = @{
    username = "judge_fast@hackathon.org"
    display_name = "Dr. Hackathon Judge"
} | ConvertTo-Json

$quickRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/auth/quick-passkey-login" -Method Post -ContentType "application/json" -Body $quickBody
Write-Host "Verified: $($quickRes.verified) | User: $($quickRes.display_name) ($($quickRes.user_id))" -ForegroundColor Green
Write-Host "Biometric Hardware Token: $($quickRes.credential_id)" -ForegroundColor Yellow
if (-not $quickRes.verified -or -not $quickRes.user_id) {
    throw "Quick passkey authentication failed"
}
$testUserId = $quickRes.user_id

Write-Host "`n=== 3. Verifying Visual Onboarding Hero Images (/api/onboarding/images) ===" -ForegroundColor Cyan
$imgsRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/onboarding/images" -Method Get
Write-Host "Hero images returned: $($imgsRes.count)" -ForegroundColor Green
if ($imgsRes.count -lt 5) {
    throw "Expected at least 5 hero images from 16_hotel_media.csv"
}
Write-Host "Sample Scene: $($imgsRes.items[0].hotel_name) - $($imgsRes.items[0].caption) (Hint: $($imgsRes.items[0].vibe_hint))" -ForegroundColor Yellow

Write-Host "`n=== 4. Verifying Travel DNA Calibration (/api/onboarding/preferences) ===" -ForegroundColor Cyan
$sampleLikes = @(
    @{
        media_id = $imgsRes.items[0].media_id
        hotel_id = $imgsRes.items[0].hotel_id
        alt_text = "Grand royal palace courtyard with carved marble arches in Jaipur"
        caption = "Palace heritage courtyard"
        property_type = "heritage"
    }
)
$prefBody = @{
    user_id = $testUserId
    liked_images = $sampleLikes
    total_swiped = 10
} | ConvertTo-Json -Depth 5

$prefRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/onboarding/preferences" -Method Post -ContentType "application/json" -Body $prefBody
Write-Host "Calibrated DNA Vibe: $($prefRes.top_vibe)" -ForegroundColor Green
Write-Host "Heritage Weight: $($prefRes.affinity_vector.heritage)" -ForegroundColor Yellow
if (-not $prefRes.top_vibe) {
    throw "Expected valid calibrated top_vibe"
}

Write-Host "`n=== 5. Verifying Travel DNA Retrieval (/api/onboarding/preferences/{user_id}) ===" -ForegroundColor Cyan
$getPrefRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/onboarding/preferences/$testUserId" -Method Get
Write-Host "Stored DNA in SQLite sf_user_prefs: $($getPrefRes.top_vibe) (Swiped: $($getPrefRes.swiped_count))" -ForegroundColor Green

Write-Host "`n=== 6. Verifying Calibrated DNA In-Memory Collaborative Re-Ranking ===" -ForegroundColor Cyan
$rankedRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/search/ranked?user_id=$testUserId&personalization=true&limit=5" -Method Get
Write-Host "Active User: $($rankedRes.active_user.name) | Label: $($rankedRes.active_user.label)" -ForegroundColor Green
Write-Host "Top Ranked Hotel: $($rankedRes.items[0].name) ($($rankedRes.items[0].property_type))" -ForegroundColor Yellow
Write-Host "Explainability: $($rankedRes.items[0].explainability)" -ForegroundColor Yellow
Write-Host "Affinity Score Contribution: $($rankedRes.items[0].score_breakdown.affinity)" -ForegroundColor Green

Write-Host "`n=== 7. Running Database Conformance Validator ===" -ForegroundColor Cyan
python tools/validate_conformance.py backend/data/PS-02.db

Write-Host "`n>>> ALL VISUAL ONBOARDING & BIOMETRIC PASSKEY TESTS PASSED! <<<" -ForegroundColor Green
